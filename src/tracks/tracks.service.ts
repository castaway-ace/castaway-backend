import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Track } from '../../generated/prisma/client.js';

interface TrackFilters {
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  starred?: boolean;
}

interface SortOptions {
  field: 'title' | 'album' | 'year' | 'added';
  direction: 'asc' | 'desc';
}

interface TrackQueryOptions {
  filters?: TrackFilters;
  sort?: SortOptions;
  pagination?: { limit: number; offset: number };
}

@Injectable()
export class TracksService {
  constructor(private readonly prisma: PrismaService) {}

  async findTracks(
    userId: string,
    options: TrackQueryOptions,
  ): Promise<Track[]> {
    const where = this.buildWhere(options.filters, userId);
    const sort = options.sort ?? { field: 'title', direction: 'asc' };

    const orderBy = this.buildOrderBy(sort);
    const take = options.pagination?.limit ?? 100;
    const skip = options.pagination?.offset ?? 0;

    return this.prisma.track.findMany({
      orderBy,
      take,
      skip,
      where,
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

    if (filters.starred !== undefined) {
      where.trackAnnotations = {
        some: { userId, starred: filters.starred },
      };
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
