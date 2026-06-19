import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ArtistOrderOptions } from '../dto/artist.dto.js';
import {
  Artist,
  ArtistRow,
  artistSelect,
  ArtistSummary,
  artistSummarySelect,
} from '../types/artists.js';
import { StorageBucket } from '../types/storage.js';

interface ArtistFilters {
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

  async find(id: string): Promise<Artist> {
    const artist = await this.prisma.artist.findUnique({
      where: { id },
      select: artistSelect,
    });

    if (!artist) {
      throw new NotFoundException('Artist does not exist');
    }

    return this.toArtist(artist);
  }

  async findWithStarred(
    userId: string,
    id: string,
  ): Promise<Artist & { starred: boolean }> {
    const artist = await this.find(id);

    const annotation = await this.prisma.artistAnnotation.findUnique({
      where: { userId_artistId: { userId, artistId: id } },
    });

    return { ...artist, starred: !!annotation };
  }

  async findAll(
    userId: string,
    options: ArtistQueryOptions,
  ): Promise<ArtistSummary[]> {
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
      select: artistSummarySelect,
    });
  }

  async updateArtist(id: string, imageKey: string): Promise<void> {
    await this.prisma.artist.update({
      where: { id },
      data: { imageKey },
    });
  }

  async findArtistImageKey(id: string): Promise<string | null> {
    const artist = await this.prisma.artist.findUnique({
      where: { id },
      select: {
        imageKey: true,
      },
    });

    if (!artist) return null;

    return artist.imageKey;
  }

  async findArtistImage(id: string): Promise<string> {
    const imageKey = await this.findArtistImageKey(id);

    if (!imageKey) {
      throw new NotFoundException('Artist Art does not exist');
    }

    const result = await this.storageService.getPresignedUrl(
      StorageBucket.ArtistArt,
      imageKey,
    );

    return result;
  }

  async updateStar(
    userId: string,
    artistId: string,
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
      const artist = await this.prisma.artist.upsert({
        where: { name },
        create: { name },
        update: {},
        select: artistSelect,
      });

      return this.toArtist(artist);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const artist = await this.prisma.artist.findUniqueOrThrow({
          where: { name },
          select: artistSelect,
        });

        return this.toArtist(artist);
      }
      throw error;
    }
  }

  private toArtist(row: ArtistRow): Artist {
    return {
      id: row.id,
      name: row.name,
      bio: row.bio,
      albums: row.albumArtists.map((albumArtist) => albumArtist.album),
    };
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
