import { Injectable, NotFoundException } from '@nestjs/common';
import { AlbumSortOptions } from '../dto/album-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageBucket, StorageService } from '../storage/storage.service.js';
import { Album, Prisma } from '../../generated/prisma/client.js';
import { Readable } from 'stream';

interface AlbumFilters {
  artistIds?: string[];
  genres?: string[];
  starred?: boolean;
}

interface AlbumQueryOptions {
  filters?: AlbumFilters;
  sort?: AlbumSortOptions;
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
  ): Promise<Album[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(
      options.sort ?? { sort: 'title', sortBy: 'asc' },
    );

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    return this.prisma.album.findMany({
      orderBy,
      take,
      skip,
      where,
    });
  }

  async findAlbumStream(id: string, range?: string): Promise<Readable> {
    const album = await this.findAlbum(id);

    if (!album?.imageKey) {
      throw new NotFoundException('Album Art does not exist');
    }

    try {
      return this.storageService.getObjectStream(
        StorageBucket.AlbumArt,
        album.imageKey,
        range,
      );
    } catch {
      throw new NotFoundException('Album art not found in storage');
    }
  }

  async updateAlbumStar(
    albumId: string,
    userId: string,
    starred: boolean,
  ): Promise<void> {
    await this.prisma.albumAnnotation.upsert({
      where: {
        userId_albumId: { userId, albumId },
      },
      create: {
        userId,
        albumId,
        starred,
        starredAt: starred ? new Date() : null,
      },
      update: {
        starred,
        starredAt: starred ? new Date() : null,
      },
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

    if (filters.starred === true) {
      where.albumAnnotations = { some: { userId, starred: true } };
    } else if (filters.starred === false) {
      where.albumAnnotations = { none: { userId, starred: true } };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    AlbumSortOptions['sort'],
    (direction: Prisma.SortOrder) => Prisma.TrackOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    sortOptions: AlbumSortOptions,
  ): Prisma.TrackOrderByWithRelationInput {
    const orderBy = AlbumsService.SORT_FIELD_MAP[sortOptions.sort];
    return orderBy(sortOptions.sortBy);
  }
}
