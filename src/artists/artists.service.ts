import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ObjectStreamResult,
  StorageService,
} from '../storage/storage.service.js';
import { Artist, Prisma } from '../../generated/prisma/client.js';
import { ArtistOrderOptions } from '../dto/artist.dto.js';
import { Artists } from '../types/artists.js';
import { StorageBucket } from '../types/storage.js';

interface ArtistFilters {
  genres?: string[];
  starred?: boolean;
  search?: string;
}

interface ArtistQueryOptions {
  filters?: ArtistFilters;
  orderOptions?: ArtistOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class ArtistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findArtist(id: string): Promise<Artist | null> {
    return this.prisma.artist.findUnique({
      where: { id },
    });
  }

  async findArtists(
    userId: string,
    options: ArtistQueryOptions,
  ): Promise<Artists> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    return this.prisma.artist.findMany({
      orderBy,
      take,
      skip,
      where,
      select: {
        id: true,
        name: true,
        imageKey: true,
      },
    });
  }

  async updateArtist(id: string, imageKey: string): Promise<void> {
    await this.prisma.artist.update({
      where: { id },
      data: { imageKey },
    });
  }

  async findArtistStream(id: string): Promise<ObjectStreamResult> {
    const artist = await this.findArtist(id);

    if (!artist?.imageKey) {
      throw new NotFoundException('Artist Art does not exist');
    }

    const result = await this.storageService.getObjectStream(
      StorageBucket.ArtistArt,
      artist.imageKey,
    );

    return {
      ...result,
      contentType: this.resolveImageContentType(
        artist.imageKey,
        result.contentType,
      ),
    };
  }

  async updateArtistStar(
    artistId: string,
    userId: string,
    starred: boolean,
  ): Promise<void> {
    if (starred) {
      await this.prisma.artistAnnotation.upsert({
        where: { userId_artistId: { userId, artistId } },
        create: { userId, artistId, starred: true },
        update: { starred: true },
      });
    } else {
      await this.prisma.artistAnnotation.deleteMany({
        where: { userId, artistId },
      });
    }
  }

  async findOrCreateArtist(name: string): Promise<Artist> {
    try {
      return await this.prisma.artist.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.artist.findUniqueOrThrow({ where: { name } });
      }
      throw error;
    }
  }

  private buildWhere(
    filters: ArtistFilters | undefined,
    userId: string,
  ): Prisma.ArtistWhereInput {
    const where: Prisma.ArtistWhereInput = {};
    if (!filters) return where;

    if (filters.starred === true) {
      where.artistAnnotations = { some: { userId } };
    }

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
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
    ArtistOrderOptions['order'],
    (direction: Prisma.SortOrder) => Prisma.ArtistOrderByWithRelationInput
  > = {
    name: (direction) => ({ name: direction }),
  };

  private buildOrderBy(
    orderOptions?: ArtistOrderOptions,
  ): Prisma.ArtistOrderByWithRelationInput {
    const ordering = orderOptions ?? { order: 'name', orderBy: 'asc' };
    const orderBy = ArtistsService.SORT_FIELD_MAP[ordering.order];
    return orderBy(ordering.orderBy);
  }
}
