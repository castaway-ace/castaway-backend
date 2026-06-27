import { Injectable, NotFoundException } from '@nestjs/common';
import { AlbumSortOptions as AlbumOrderOptions } from '../dto/album.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma, Album as PrismaAlbum } from '../../generated/prisma/client.js';
import {
  Album,
  albumSelect,
  albumSummarySelect,
  AlbumSummary,
} from './albums.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { IPicture } from 'music-metadata';
import { buildAlbumIdentity } from '../utils/album-identity.js';

interface AlbumFilters {
  artistIds?: string[];
  genres?: string[];
  starred?: boolean;
  search?: string;
}

interface AlbumQueryOptions {
  filters?: AlbumFilters;
  orderOptions?: AlbumOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class AlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(
    title: string,
    artistIds: string[],
    releaseDate: Date,
  ): Promise<PrismaAlbum> {
    const identityKey = buildAlbumIdentity(title, artistIds);
    const album = await this.prisma.album.create({
      data: {
        title,
        releaseDate,
        identityKey,
        albumArtists: {
          create: artistIds.map((artistId) => ({ artistId })),
        },
      },
    });

    return album;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.album.delete({
      where: { id },
    });
  }

  async find(userId: string, id: string): Promise<Album> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: albumSelect,
    });

    if (!album) {
      throw new NotFoundException('Album does not exist');
    }

    const tracks = album.tracks
      .map(({ trackArtists, ...track }) => ({
        ...track,
        artists: trackArtists.map((ta) => ta.artist),
      }))
      .sort(
        (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber,
      );

    const annotation = await this.prisma.albumAnnotation.findUnique({
      where: { userId_albumId: { userId, albumId: id } },
    });

    return {
      id: album.id,
      title: album.title,
      releaseDate: album.releaseDate,
      compilation: album.compilation,
      genres: album.genres,
      starred: !!annotation,
      artists: album.albumArtists.map((ta) => ta.artist),
      tracks,
    };
  }

  async findAll(
    userId: string,
    options: AlbumQueryOptions,
  ): Promise<AlbumSummary[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    const albums = await this.prisma.album.findMany({
      orderBy,
      take,
      skip,
      where,
      select: albumSummarySelect,
    });

    return albums.map(({ albumArtists, ...album }) => ({
      ...album,
      artists: albumArtists.map((ta) => ta.artist),
    }));
  }

  async updateAlbum(id: string, imageKey: string): Promise<void> {
    await this.prisma.album.update({
      where: { id },
      data: { imageKey },
    });
  }

  async findAlbumImageKey(id: string): Promise<string | null> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: {
        imageKey: true,
      },
    });

    if (!album) return null;

    return album.imageKey;
  }

  async findAlbumCover(id: string): Promise<string> {
    const imageKey = await this.findAlbumImageKey(id);

    if (!imageKey) {
      throw new NotFoundException('Album Art does not exist');
    }

    return this.storageService.getPresignedUrl(
      StorageBucket.AlbumArt,
      imageKey,
    );
  }

  async setAlbumCover(albumId: string, picture: IPicture): Promise<void> {
    const fileKey = `${albumId}/cover.jpg`;
    const coverBuffer = Buffer.from(picture.data);

    await this.storageService.putObject(
      StorageBucket.AlbumArt,
      fileKey,
      coverBuffer,
      {
        contentType: picture.format,
        size: coverBuffer.length,
        metadata: { source: 'embedded' },
      },
    );

    try {
      await this.updateAlbum(albumId, fileKey);
    } catch (error) {
      await this.storageService.deleteObject(StorageBucket.AlbumArt, fileKey);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Album not found');
      }
      throw error;
    }
  }

  async findAlbumCoverUrl(id: string): Promise<string | null> {
    const imageKey = await this.findAlbumImageKey(id);
    if (!imageKey) return null;
    return this.storageService.getPresignedUrl(
      StorageBucket.AlbumArt,
      imageKey,
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

  async updateStar(
    userId: string,
    albumId: string,
    starred: boolean,
  ): Promise<void> {
    if (starred) {
      await this.prisma.albumAnnotation.upsert({
        where: { userId_albumId: { userId, albumId } },
        create: { userId, albumId, starred: true },
        update: { starred: true },
      });
    } else {
      await this.prisma.albumAnnotation.deleteMany({
        where: { userId, albumId },
      });
    }
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
      where.albumAnnotations = { some: { userId } };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    AlbumOrderOptions['order'],
    (direction: Prisma.SortOrder) => Prisma.AlbumOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    orderOptions?: AlbumOrderOptions,
  ): Prisma.AlbumOrderByWithRelationInput {
    const ordering = orderOptions ?? { order: 'title', orderBy: 'asc' };
    const orderBy = AlbumsService.SORT_FIELD_MAP[ordering.order];
    return orderBy(ordering.orderBy);
  }
}
