import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma, Album as PrismaAlbum } from '../generated/prisma/client.js';
import {
  Album,
  albumSelect,
  albumSummarySelect,
  AlbumSummary,
} from './albums.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { IPicture } from 'music-metadata';
import { buildAlbumIdentity } from '../utils/album-identity.js';
import { AlbumSortOptions, AlbumSortOrder } from './dto/album-query.dto.js';
import { buildOrderBy } from '../common/query.js';
import { withStorageCleanup } from '../common/storage-cleanup.js';
import { isPrismaKnownError } from '../common/prisma-error.js';

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
  private readonly logger = new Logger(AlbumsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(
    userId: string,
    options: AlbumQueryOptions,
  ): Promise<AlbumSummary[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.sortOptions);

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

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
      artists: albumArtists.map((ta) => ta.artist),
      starred: albumAnnotations.length > 0,
    }));
  }

  async find(userId: string, id: string): Promise<Album> {
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
        artists: trackArtists.map((ta) => ta.artist),
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
      artists: album.albumArtists.map((ta) => ta.artist),
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

    if (!album) {
      throw new NotFoundException('Album Art does not exist');
    }

    return this.storageService.getPresignedUrl(
      StorageBucket.AlbumArt,
      album.imageKey,
    );
  }

  async create(
    title: string,
    artistIds: string[],
    releaseDate: Date,
  ): Promise<PrismaAlbum> {
    const identityKey = buildAlbumIdentity(title, artistIds);
    try {
      return await this.prisma.album.create({
        data: {
          title,
          releaseDate,
          identityKey,
          albumArtists: { create: artistIds.map((artistId) => ({ artistId })) },
        },
      });
    } catch (error) {
      if (isPrismaKnownError(error, 'P2002')) {
        throw new ConflictException('Album already imported');
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const album = await this.prisma.album.findUnique({
      where: { id },
      select: { imageKey: true },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    if (album.imageKey) {
      await this.storageService
        .deleteObject(StorageBucket.AlbumArt, album.imageKey)
        .catch((error: unknown) =>
          this.logger.warn(
            `Failed to delete cover ${album.imageKey} for album ${id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }

    await this.prisma.album.delete({ where: { id } });
  }

  async createAlbumCover(albumId: string, picture: IPicture): Promise<void> {
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
      await withStorageCleanup(
        () => this.setImageKey(albumId, fileKey),
        () => this.storageService.deleteObject(StorageBucket.AlbumArt, fileKey),
        (error) =>
          this.logger.warn(
            `Failed to clean up orphaned cover ${fileKey}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
      );
    } catch (error) {
      if (isPrismaKnownError(error, 'P2025')) {
        throw new NotFoundException('Album not found');
      }
      throw error;
    }
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

  private async setImageKey(id: string, imageKey: string): Promise<void> {
    await this.prisma.album.update({
      where: { id },
      data: { imageKey },
    });
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
