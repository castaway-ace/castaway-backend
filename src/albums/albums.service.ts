import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma, Album as PrismaAlbum } from '../generated/prisma/client.js';
import {
  AlbumCreateData,
  albumSelect,
  albumSummarySelect,
} from './albums.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { IPicture } from 'music-metadata';
import { AlbumSortOptions, AlbumSortOrder } from './dto/album-query.dto.js';
import { buildOrderBy, clampPagination } from '../common/query.js';
import { AlbumEntity, AlbumSummaryEntity } from './albums.entity.js';
import { buildAlbumIdentity } from '../common/album-identity.js';
import { toArtistRef } from '../common/artist-ref.js';

interface AlbumFilters {
  artistIds?: string[];
  genres?: string[];
  starred?: boolean;
  search?: string;
}

interface AlbumQueryOptions {
  filters?: AlbumFilters;
  sortOptions?: AlbumSortOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(
    userId: string,
    options: AlbumQueryOptions,
  ): Promise<AlbumSummaryEntity[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.sortOptions);
    const { take, skip } = clampPagination(options.pagination);

    const albums = await this.prisma.album.findMany({
      orderBy,
      take,
      skip,
      where,
      select: {
        ...albumSummarySelect,
        albumAnnotations: {
          where: { userId, starred: true },
          select: { albumId: true },
          take: 1,
        },
      },
    });

    return albums.map(({ albumAnnotations, albumArtists, ...album }) => ({
      ...album,
      artists: albumArtists.map((ta) => toArtistRef(ta.artist)),
      starred: albumAnnotations.length > 0,
    }));
  }

  async find(userId: string, id: string): Promise<AlbumEntity> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: {
        ...albumSelect,
        albumAnnotations: {
          where: { userId, starred: true },
          select: { albumId: true },
          take: 1,
        },
      },
    });

    if (!album) {
      throw new NotFoundException('Album does not exist');
    }

    const tracks = album.tracks
      .map(({ trackArtists, ...track }) => ({
        ...track,
        artists: trackArtists.map((ta) => toArtistRef(ta.artist)),
      }))
      .sort(
        (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber,
      );

    const starred = album.albumAnnotations.length > 0;

    return {
      id: album.id,
      title: album.title,
      releaseDate: album.releaseDate,
      compilation: album.compilation,
      genres: album.genres,
      starred,
      artists: album.albumArtists.map((ta) => toArtistRef(ta.artist)),
      tracks,
    };
  }

  async getAlbumCoverUrl(id: string): Promise<string> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: {
        imageKey: true,
      },
    });

    if (!album?.imageKey) {
      throw new NotFoundException('Album Art does not exist');
    }

    return this.storageService.getPresignedUrl(
      StorageBucket.AlbumArt,
      album.imageKey,
    );
  }

  async star(userId: string, albumId: string): Promise<void> {
    await this.prisma.albumAnnotation.upsert({
      where: { userId_albumId: { userId, albumId } },
      create: { userId, albumId, starred: true },
      update: { starred: true },
    });
  }

  async unstar(userId: string, albumId: string): Promise<void> {
    await this.prisma.albumAnnotation.deleteMany({
      where: { userId, albumId },
    });
  }

  async create(
    data: AlbumCreateData,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaAlbum> {
    const client = tx ?? this.prisma;
    const { artistIds, ...album } = data;
    return await client.album.create({
      data: {
        ...album,
        albumArtists: {
          create: artistIds.map((artistId) => ({ artistId })),
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: { imageKey: true },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    await this.prisma.album.delete({ where: { id } });

    if (album.imageKey) {
      await this.storageService.deleteObjectQuietly(
        StorageBucket.AlbumArt,
        album.imageKey,
        `cover for album ${id}`,
      );
    }
  }

  async uploadCover(coverKey: string, picture: IPicture): Promise<void> {
    const coverBuffer = Buffer.from(picture.data);
    await this.storageService.putObject(
      StorageBucket.AlbumArt,
      coverKey,
      coverBuffer,
      {
        contentType: picture.format,
        size: coverBuffer.length,
        metadata: { source: 'embedded' },
      },
    );
  }

  async deleteCoverObject(coverKey: string): Promise<void> {
    await this.storageService.deleteObjectQuietly(
      StorageBucket.AlbumArt,
      coverKey,
      'album cover cleanup',
    );
  }

  async findAlbumCoverMap(ids: string[]): Promise<Map<string, string>> {
    const albums = await this.prisma.album.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        imageKey: true,
      },
    });

    const entries = await Promise.all(
      albums.map(async (album): Promise<[string, string] | null> => {
        if (!album.imageKey) return null;
        const url = await this.storageService.getPresignedUrl(
          StorageBucket.AlbumArt,
          album.imageKey,
        );
        return [album.id, url];
      }),
    );

    return new Map(
      entries.filter((entry): entry is [string, string] => entry !== null),
    );
  }

  async assertNotImported(title: string, artistIds: string[]): Promise<string> {
    const identityKey = buildAlbumIdentity(title, artistIds);
    const existing = await this.prisma.album.findUnique({
      where: { identityKey },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Album already imported');
    }
    return identityKey;
  }

  buildCoverKey(albumId: string): string {
    return `${albumId}/cover.jpg`;
  }

  private buildWhere(
    filters: AlbumFilters | undefined,
    userId: string,
  ): Prisma.AlbumWhereInput {
    const where: Prisma.AlbumWhereInput = {};
    if (!filters) return where;

    if (filters.artistIds?.length) {
      where.albumArtists = {
        some: { artistId: { in: filters.artistIds } },
      };
    }

    if (filters.genres?.length) {
      where.genres = { hasSome: filters.genres };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        {
          albumArtists: {
            some: {
              artist: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    if (filters.starred === true) {
      where.albumAnnotations = { some: { userId, starred: true } };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    AlbumSortOrder,
    (direction: Prisma.SortOrder) => Prisma.AlbumOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    options?: AlbumSortOptions,
  ): Prisma.AlbumOrderByWithRelationInput[] {
    return buildOrderBy(
      AlbumsService.SORT_FIELD_MAP,
      { id: 'asc' },
      { order: 'title', orderBy: 'asc' },
      options,
    );
  }
}
