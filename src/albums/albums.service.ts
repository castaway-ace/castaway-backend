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
} from '../types/albums.js';
import { StorageBucket } from '../types/storage.js';
import { ArtistAlbum } from '../types/artists.js';

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

  async find(id: string): Promise<Album> {
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

    return {
      id: album.id,
      title: album.title,
      releaseDate: album.releaseDate,
      compilation: album.compilation,
      genres: album.genres,
      artists: album.albumArtists.map((ta) => ta.artist),
      tracks,
    };
  }

  async findWithStarred(
    userId: string,
    id: string,
  ): Promise<Album & { starred: boolean }> {
    const album = await this.find(id);

    const annotation = await this.prisma.albumAnnotation.findUnique({
      where: { userId_albumId: { userId, albumId: id } },
    });

    return { ...album, starred: !!annotation };
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

    const result = await this.storageService.getPresignedUrl(
      StorageBucket.AlbumArt,
      imageKey,
    );

    return result;
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

  async findAlbumsByArtist(artistId: string): Promise<ArtistAlbum[]> {
    return this.prisma.album.findMany({
      where: { albumArtists: { some: { artistId } } },
      select: {
        id: true,
        title: true,
        releaseDate: true,
        imageKey: true,
      },
      orderBy: { releaseDate: 'desc' },
    });
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

  async findOrCreateAlbum(
    title: string,
    artistIds: string[],
    releaseDate: Date,
  ): Promise<PrismaAlbum> {
    const existing = await this.prisma.album.findFirst({
      where: {
        title,
        AND: artistIds.map((artistId) => ({
          albumArtists: { some: { artistId } },
        })),
      },
    });

    if (existing) return existing;

    try {
      return await this.prisma.album.create({
        data: {
          title,
          releaseDate,
          albumArtists: {
            create: artistIds.map((artistId) => ({ artistId })),
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const album = await this.prisma.album.findFirst({
          where: {
            title,
            AND: artistIds.map((artistId) => ({
              albumArtists: { some: { artistId } },
            })),
          },
        });
        if (!album) {
          throw new Error(
            `Album "${title}" had unique conflict but could not be re-fetched`,
          );
        }
        return album;
      }
      throw error;
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

  private readonly imageMimeByExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  private resolveImageContentType(key: string, fromStorage?: string): string {
    if (fromStorage && fromStorage !== 'application/octet-stream') {
      return fromStorage;
    }
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return this.imageMimeByExt[ext] ?? 'application/octet-stream';
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
