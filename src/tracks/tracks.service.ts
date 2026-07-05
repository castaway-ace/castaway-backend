import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Track as PrismaTrack } from '../generated/prisma/client.js';
import {
  ObjectStreamResult,
  StorageService,
} from '../storage/storage.service.js';
import { TrackOrderOptions, TrackSortOrder } from './dto/track-query.dto.js';
import {
  TrackCreateData,
  trackSelect,
  trackSummarySelect,
} from './tracks.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { TrackEntity, TrackSummaryEntity } from './tracks.entity.js';
import { createReadStream } from 'fs';
import { buildOrderBy, clampPagination } from '../common/query.js';
import type { MetadataTags } from '../admin/admin.types.js';

interface TrackFilters {
  artistIds?: string[];
  albumIds?: string[];
  genres?: string[];
  starred?: boolean;
  search?: string;
}

interface TrackQueryOptions {
  filters?: TrackFilters;
  sortOptions?: TrackOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistService: PlaylistsService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(
    userId: string,
    options: TrackQueryOptions,
  ): Promise<TrackSummaryEntity[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.sortOptions);
    const { take, skip } = clampPagination(options.pagination);

    const tracks = await this.prisma.track.findMany({
      orderBy,
      take,
      skip,
      where,
      select: {
        ...trackSummarySelect,
        trackAnnotations: {
          where: { userId, starred: true },
          select: { trackId: true },
          take: 1,
        },
      },
    });

    return tracks.map(
      ({ trackAnnotations, trackArtists, album, ...track }) => ({
        ...track,
        artists: trackArtists.map((ta) => ta.artist),
        album,
        starred: trackAnnotations.length > 0,
      }),
    );
  }

  async find(userId: string, id: string): Promise<TrackEntity> {
    const track = await this.prisma.track.findUnique({
      where: { id },
      select: {
        ...trackSelect,
        trackAnnotations: {
          where: { userId, starred: true },
          select: { trackId: true },
          take: 1,
        },
      },
    });

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    const { trackAnnotations, trackArtists, album, ...rest } = track;

    return {
      ...rest,
      album,
      artists: trackArtists.map((ta) => ta.artist),
      starred: trackAnnotations.length > 0,
    };
  }

  async getTrackStream(
    id: string,
    range?: string,
  ): Promise<ObjectStreamResult> {
    const track = await this.prisma.track.findUnique({
      where: { id },
      select: {
        fileKey: true,
      },
    });

    if (!track?.fileKey) {
      throw new NotFoundException('Track stream does not exist');
    }

    const fileKey = track.fileKey;

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

  async setStarred(
    userId: string,
    trackId: string,
    starred: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const track = await tx.track.findUnique({
        where: { id: trackId },
        select: { id: true },
      });

      if (!track) {
        throw new NotFoundException('Track not found');
      }

      const annotation = await tx.trackAnnotation.findUnique({
        where: { userId_trackId: { userId, trackId } },
        select: { starred: true },
      });

      const currentlyStarred = annotation?.starred ?? false;

      if (currentlyStarred === starred) {
        return;
      }

      await tx.trackAnnotation.upsert({
        where: { userId_trackId: { userId, trackId } },
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

      const likedPlaylist = await this.playlistService.findLikedRecord(
        userId,
        tx,
      );

      if (starred) {
        await this.playlistService.addTrack(
          userId,
          likedPlaylist.id,
          trackId,
          tx,
        );
      } else {
        await this.playlistService.deleteTrack(
          userId,
          likedPlaylist.id,
          trackId,
          tx,
        );
      }
    });
  }

  async create(
    data: TrackCreateData,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaTrack> {
    const client = tx ?? this.prisma;
    const { artistIds, ...track } = data;
    return await client.track.create({
      data: {
        ...track,
        trackArtists: {
          create: artistIds.map((artistId) => ({ artistId })),
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    const track = await this.prisma.track.findUnique({
      where: { id },
      select: { fileKey: true },
    });

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    await this.prisma.track.delete({ where: { id } });

    await this.storageService.deleteObjectQuietly(
      StorageBucket.Tracks,
      track.fileKey,
      `audio for track ${id}`,
    );
  }

  async uploadTrackFile(
    file: Express.Multer.File,
    fileKey: string,
  ): Promise<void> {
    await this.storageService.putObject(
      StorageBucket.Tracks,
      fileKey,
      createReadStream(file.path),
      {
        contentType: file.mimetype,
        size: file.size,
        metadata: { originalName: file.originalname },
      },
    );
  }

  async deleteTrackObjects(fileKeys: string[]): Promise<void> {
    await Promise.all(
      fileKeys.map((fileKey) =>
        this.storageService.deleteObjectQuietly(
          StorageBucket.Tracks,
          fileKey,
          'track cleanup',
        ),
      ),
    );
  }

  async deleteAlbumTrackFiles(albumId: string): Promise<void> {
    const tracks = await this.prisma.track.findMany({
      where: { albumId },
      select: { fileKey: true },
    });
    await this.deleteTrackObjects(tracks.map(({ fileKey }) => fileKey));
  }

  buildFileKey(albumId: string, tags: MetadataTags, suffix: string): string {
    return `${albumId}/${tags.discNumber}-${String(tags.trackNumber).padStart(2, '0')}.${suffix}`;
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
    TrackSortOrder,
    (direction: Prisma.SortOrder) => Prisma.TrackOrderByWithRelationInput
  > = {
    title: (direction) => ({ title: direction }),
    album: (direction) => ({ album: { title: direction } }),
    year: (direction) => ({ releaseDate: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private static readonly MIME_BY_EXT: Record<string, string> = {
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    wav: 'audio/wav',
  };

  private static readonly MIME_ALIASES: Record<string, string> = {
    'audio/x-flac': 'audio/flac',
    'audio/x-wav': 'audio/wav',
    'audio/x-m4a': 'audio/mp4',
  };

  private resolveContentType(key: string, fromStorage?: string): string {
    if (fromStorage && fromStorage !== 'application/octet-stream') {
      return TracksService.MIME_ALIASES[fromStorage] ?? fromStorage;
    }
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return TracksService.MIME_BY_EXT[ext] ?? 'application/octet-stream';
  }

  private buildOrderBy(
    options?: TrackOrderOptions,
  ): Prisma.TrackOrderByWithRelationInput[] {
    return buildOrderBy(
      TracksService.SORT_FIELD_MAP,
      { id: 'asc' },
      { order: 'title', orderBy: 'asc' },
      options,
    );
  }
}
