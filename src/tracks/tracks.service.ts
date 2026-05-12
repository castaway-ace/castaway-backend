import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Track } from '../../generated/prisma/client.js';
import { StorageBucket, StorageService } from '../storage/storage.service.js';
import { Readable } from 'stream';
import { SortOptions } from '../dto/track-query.dto.js';

interface TrackFilters {
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  starred?: boolean;
}

interface TrackQueryOptions {
  filters?: TrackFilters;
  sort?: SortOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findTrack(id: string): Promise<Track | null> {
    return this.prisma.track.findUnique({
      where: {
        id,
      },
    });
  }

  async findTracks(
    userId: string,
    options: TrackQueryOptions,
  ): Promise<Track[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(
      options.sort ?? { field: 'title', direction: 'asc' },
    );

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    return this.prisma.track.findMany({
      orderBy,
      take,
      skip,
      where,
    });
  }

  async findTrackStream(id: string, range?: string): Promise<Readable> {
    const track = await this.findTrack(id);

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    try {
      return this.storageService.getObjectStream(
        StorageBucket.Tracks,
        track.fileKey,
        range,
      );
    } catch {
      throw new NotFoundException('Track file not found in storage');
    }
  }

  async updateTrackStar(
    trackId: string,
    userId: string,
    starred: boolean,
  ): Promise<void> {
    await this.prisma.trackAnnotation.upsert({
      where: {
        userId_trackId: { userId, trackId },
      },
      create: {
        userId,
        trackId,
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
    filters: TrackFilters | undefined,
    userId: string,
  ): Prisma.TrackWhereInput {
    const where: Prisma.TrackWhereInput = {};
    if (!filters) return where;

    if (filters.albumIds?.length) {
      where.albumId = { in: filters.albumIds };
    }

    if (filters.artistIds?.length) {
      where.trackArtists = {
        some: { artistId: { in: filters.artistIds } },
      };
    }

    if (filters.genres?.length) {
      where.genres = { hasSome: filters.genres };
    }

    if (filters.starred === true) {
      where.trackAnnotations = { some: { userId, starred: true } };
    } else if (filters.starred === false) {
      where.trackAnnotations = { none: { userId, starred: true } };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    SortOptions['field'],
    (direction: Prisma.SortOrder) => Prisma.TrackOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    album: (direction) => ({ album: { title: direction } }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    sortOptions: SortOptions,
  ): Prisma.TrackOrderByWithRelationInput {
    const orderBy = TracksService.SORT_FIELD_MAP[sortOptions.field];
    return orderBy(sortOptions.direction);
  }
}
