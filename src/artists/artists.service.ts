import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  Artist,
  ArtistCreateData,
  ArtistRow,
  artistSelect,
  ArtistSummary,
  artistSummarySelect,
} from './artists.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { ArtistEntity } from './artists.entity.js';
import { ArtistOrderOptions, ArtistSortOrder } from './dto/artist-query.dto.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { createReadStream } from 'fs';
import { buildOrderBy, clampPagination } from '../common/query.js';

interface ArtistFilters {
  starred?: boolean;
  search?: string;
}

interface ArtistQueryOptions {
  filters?: ArtistFilters;
  sortOptions?: ArtistOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class ArtistsService {
  private readonly logger = new Logger(ArtistsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(
    userId: string,
    options: ArtistQueryOptions,
  ): Promise<ArtistSummary[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.sortOptions);
    const { take, skip } = clampPagination(options.pagination);

    const artists = await this.prisma.artist.findMany({
      orderBy,
      take,
      skip,
      where,
      select: {
        ...artistSummarySelect,
        artistAnnotations: {
          where: { userId, starred: true },
          select: { artistId: true },
          take: 1,
        },
      },
    });

    return artists.map(({ artistAnnotations, ...artist }) => ({
      ...artist,
      starred: artistAnnotations.length > 0,
    }));
  }

  async find(userId: string, id: string): Promise<ArtistEntity> {
    const artist = await this.prisma.artist.findUnique({
      where: { id },
      select: {
        ...artistSelect,
        artistAnnotations: {
          where: { userId, starred: true },
          select: { artistId: true },
          take: 1,
        },
      },
    });

    if (!artist) {
      throw new NotFoundException('Artist does not exist');
    }

    const adjustedArtist = this.toArtist(artist);

    const starred = artist.artistAnnotations.length > 0;

    return { ...adjustedArtist, starred };
  }

  async getArtistImageUrl(id: string): Promise<string> {
    const artist = await this.prisma.artist.findUnique({
      where: { id },
      select: {
        imageKey: true,
      },
    });

    if (!artist?.imageKey) {
      throw new NotFoundException('Artist Image does not exist');
    }

    return this.storageService.getPresignedUrl(
      StorageBucket.ArtistArt,
      artist.imageKey,
    );
  }

  async star(userId: string, artistId: string): Promise<void> {
    await this.prisma.artistAnnotation.upsert({
      where: { userId_artistId: { userId, artistId } },
      create: { userId, artistId, starred: true },
      update: { starred: true },
    });
  }

  async unstar(userId: string, artistId: string): Promise<void> {
    await this.prisma.artistAnnotation.deleteMany({
      where: { userId, artistId },
    });
  }

  async create(data: ArtistCreateData): Promise<ArtistRef> {
    return await this.prisma.artist.create({
      data,
      select: { id: true, name: true },
    });
  }

  async delete(id: string): Promise<void> {
    const artist = await this.prisma.artist.findUnique({
      where: { id },
      select: { imageKey: true },
    });

    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    if (artist.imageKey) {
      await this.storageService
        .deleteObject(StorageBucket.ArtistArt, artist.imageKey)
        .catch((error: unknown) =>
          this.logger.warn(
            `Failed to delete image ${artist.imageKey} for artist ${id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }

    await this.prisma.artist.delete({ where: { id } });
  }

  async uploadImage(
    artistId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    const fileKey = `${artistId}/cover.jpg`;

    await this.storageService.putObject(
      StorageBucket.ArtistArt,
      fileKey,
      createReadStream(file.path),
      {
        contentType: file.mimetype,
        size: file.size,
        metadata: { originalName: file.originalname },
      },
    );

    await this.setImageKey(artistId, fileKey);
  }

  async findIdsByNames(names: string[]): Promise<Map<string, string>> {
    const artists = await this.prisma.artist.findMany({
      where: { name: { in: names } },
      select: { name: true, id: true },
    });
    return new Map(artists.map((artist) => [artist.name, artist.id]));
  }

  private async setImageKey(id: string, imageKey: string): Promise<void> {
    await this.prisma.artist.update({
      where: { id },
      data: { imageKey },
    });
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
      where.artistAnnotations = { some: { userId, starred: true } };
    }

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    ArtistSortOrder,
    (direction: Prisma.SortOrder) => Prisma.ArtistOrderByWithRelationInput
  > = {
    name: (direction) => ({ name: direction }),
  };

  private buildOrderBy(
    options?: ArtistOrderOptions,
  ): Prisma.ArtistOrderByWithRelationInput[] {
    return buildOrderBy(
      ArtistsService.SORT_FIELD_MAP,
      { id: 'asc' },
      { order: 'name', orderBy: 'asc' },
      options,
    );
  }
}
