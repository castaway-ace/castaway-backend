import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Track as PrismaTrack } from '../../generated/prisma/client.js';
import {
  ObjectStreamResult,
  StorageService,
} from '../storage/storage.service.js';
import { TrackSortOptions as TrackOrderOptions } from '../dto/track.dto.js';
import {
  Track,
  trackSelect,
  TrackSummary,
  trackSummarySelect,
} from '../types/tracks.js';
import { StorageBucket } from '../types/storage.js';
import { Artist } from '../types/artists.js';

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
  suffix: string;
  genres: string[];
  bitRate: number;
  sampleRate: number;
  bitDepth: number;
  releaseDate: Date;
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
    suffix,
    genres,
    bitRate,
    sampleRate,
    bitDepth,
    releaseDate,
    artists,
  }: CreateTrackItem): Promise<PrismaTrack | null> {
    return this.prisma.track.create({
      data: {
        title,
        albumId,
        fileKey,
        trackNumber,
        discNumber,
        duration,
        size,
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

  async find(id: string): Promise<Track> {
    const track = await this.prisma.track.findUnique({
      where: { id },
      select: trackSelect,
    });

    if (!track) {
      throw new NotFoundException('Track does not exist');
    }

    return {
      id: track.id,
      title: track.title,
      genres: track.genres,
      duration: track.duration,
      releaseDate: track.releaseDate,
      suffix: track.suffix,
      bitRate: track.bitRate,
      albumId: track.albumId,
      sampleRate: track.sampleRate,
      bitDepth: track.bitDepth,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      size: track.size,
      album: track.album,
      artists: track.trackArtists.map((ta) => ta.artist),
    };
  }

  async findTrackFileKey(id: string): Promise<string | null> {
    const track = await this.prisma.track.findUnique({
      where: { id },
      select: {
        fileKey: true,
      },
    });

    if (!track) return null;

    return track.fileKey;
  }

  async findAll(
    userId: string,
    options: TrackQueryOptions,
  ): Promise<TrackSummary[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    const tracks = await this.prisma.track.findMany({
      orderBy,
      take,
      skip,
      where,
      select: trackSummarySelect,
    });

    const results = await Promise.all(
      tracks.map(async ({ trackArtists, album, ...track }) => {
        const starred = await this.prisma.trackAnnotation.findUnique({
          where: { userId_trackId: { userId, trackId: track.id } },
        });

        return {
          ...track,
          artists: trackArtists.map((ta) => ta.artist),
          album: album,
          starred: !!starred,
        };
      }),
    );

    return results;
  }

  async findStarredTrackIds(userId: string): Promise<string[]> {
    const annotations = await this.prisma.trackAnnotation.findMany({
      where: { userId, starred: true },
      select: { trackId: true },
    });
    return annotations.map((a) => a.trackId);
  }

  async findTrackStream(
    id: string,
    range?: string,
  ): Promise<ObjectStreamResult> {
    const fileKey = await this.findTrackFileKey(id);

    if (!fileKey) {
      throw new NotFoundException('Track stream does not exist');
    }

    const result = await this.storageService.getObjectStream(
      StorageBucket.Tracks,
      fileKey,
      range,
    );

    return {
      ...result,
      contentType: this.resolveContentType(fileKey, result.contentType),
    };
  }

  async updateStar(
    userId: string,
    trackId: string,
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

  private readonly mimeByExt: Record<string, string> = {
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    wav: 'audio/wav',
  };

  private resolveContentType(key: string, fromStorage?: string): string {
    if (fromStorage && fromStorage !== 'application/octet-stream') {
      return fromStorage;
    }
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return this.mimeByExt[ext] ?? 'application/octet-stream';
  }

  private buildOrderBy(
    orderOptions?: TrackOrderOptions,
  ): Prisma.TrackOrderByWithRelationInput {
    const ordering = orderOptions ?? { order: 'title', orderBy: 'asc' };
    const orderBy = TracksService.SORT_FIELD_MAP[ordering.order];
    return orderBy(ordering.orderBy);
  }
}
