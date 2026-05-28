import { Injectable, NotFoundException } from '@nestjs/common';
import { AlbumSortOptions as AlbumOrderOptions } from '../dto/album.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ObjectStreamResult,
  StorageService,
} from '../storage/storage.service.js';
import { Album, Prisma } from '../../generated/prisma/client.js';
import { Albums } from '../types/albums.js';
import { StorageBucket } from '../types/storage.js';

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

  async findAlbum(id: string): Promise<Album | null> {
    return this.prisma.album.findUnique({
      where: { id },
    });
  }

  async findAlbums(
    userId: string,
    options: AlbumQueryOptions,
  ): Promise<Albums> {
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
      select: {
        id: true,
        title: true,
        releaseDate: true,
        imageKey: true,
        genres: true,
        albumArtists: {
          include: {
            artist: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return albums.map(({ albumArtists, ...album }) => ({
      ...album,
      artists: albumArtists.map((ta) => ta.artist.name),
    }));
  }

  async updateAlbum(id: string, imageKey: string): Promise<void> {
    await this.prisma.album.update({
      where: { id },
      data: { imageKey },
    });
  }

  async findAlbumStream(id: string): Promise<ObjectStreamResult> {
    const album = await this.findAlbum(id);

    if (!album?.imageKey) {
      throw new NotFoundException('Album Art does not exist');
    }

    const result = await this.storageService.getObjectStream(
      StorageBucket.AlbumArt,
      album.imageKey,
    );

    return {
      ...result,
      contentType: this.resolveImageContentType(
        album.imageKey,
        result.contentType,
      ),
    };
  }

  async updateAlbumStar(
    albumId: string,
    userId: string,
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
  ): Promise<Album> {
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
