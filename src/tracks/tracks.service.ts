import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Artist, Prisma, Track } from '../../generated/prisma/client.js';
import { StorageBucket, StorageService } from '../storage/storage.service.js';
import { Readable } from 'stream';
import { TrackSortOptions as TrackOrderOptions } from '../dto/track.dto.js';

interface TrackFilters {
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  starred?: boolean;
  search?: string;
}

interface TrackQueryOptions {
  filters?: TrackFilters;
  orderOptions?: TrackOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

interface CreateTrackItem {
  title: string;
  albumId: string;
  fileKey: string;
  trackNumber: number;
  discNumber: number;
  duration: number;
  size: number;
  codec: string;
  suffix: string;
  genres: string[];
  bitRate: number;
  sampleRate: number;
  bitDepth: number;
  releaseDate: string;
  artists: Artist[];
}

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createTrack({
    title,
    albumId,
    fileKey,
    trackNumber,
    discNumber,
    duration,
    size,
    codec,
    suffix,
    genres,
    bitRate,
    sampleRate,
    bitDepth,
    releaseDate,
    artists,
  }: CreateTrackItem): Promise<Track | null> {
    return this.prisma.track.create({
      data: {
        title,
        albumId,
        fileKey,
        trackNumber,
        discNumber,
        duration,
        size,
        codec,
        suffix,
        genres,
        bitRate,
        sampleRate,
        bitDepth,
        releaseDate,
        trackArtists: {
          create: artists.map((artist) => ({ artistId: artist.id })),
        },
      },
    });
  }

  async findTrack(id: string): Promise<Track | null> {
    return this.prisma.track.findUnique({
      where: { id },
      include: {
        trackArtists: {
          select: { artistId: true },
        },
      },
    });
  }

  async findTracks(
    userId: string,
    options: TrackQueryOptions,
  ): Promise<Track[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);

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

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        {
          trackArtists: {
            some: {
              artist: {
                name: { contains: filters.search, mode: 'insensitive' },
              },
            },
          },
        },
        {
          album: {
            title: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (filters.starred === true) {
      where.trackAnnotations = { some: { userId, starred: true } };
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    TrackOrderOptions['order'],
    (direction: Prisma.SortOrder) => Prisma.TrackOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    album: (direction) => ({ album: { title: direction } }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    orderOptions?: TrackOrderOptions,
  ): Prisma.TrackOrderByWithRelationInput {
    const ordering = orderOptions ?? { order: 'title', orderBy: 'asc' };
    const orderBy = TracksService.SORT_FIELD_MAP[ordering.order];
    return orderBy(ordering.orderBy);
  }
}
