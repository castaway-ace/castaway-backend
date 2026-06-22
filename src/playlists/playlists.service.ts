import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistType, Prisma } from '../../generated/prisma/client.js';
import {
  Playlist,
  PlaylistIdentity,
  playlistIdentitySelect,
  PlaylistRow,
  playlistSelect,
  PlaylistSummary,
  playlistSummarySelect,
  PlaylistTrack,
  playlistTrackSelect,
  PlaylistTracksRow,
} from '../types/playlists.js';
import { PlaylistOrderOptions } from '../dto/playlist.dto.js';
import { AlbumsService } from '../albums/albums.service.js';

interface PlaylistFilters {
  onlyUser?: boolean;
}

interface PlaylistQueryOptions {
  filters?: PlaylistFilters;
  orderOptions?: PlaylistOrderOptions;
  pagination?: { limit?: number; offset?: number };
}

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly albumService: AlbumsService,
  ) {}

  async create(userId: string, name: string): Promise<PlaylistIdentity> {
    const playlist = await this.prisma.playlist.create({
      data: {
        ownerId: userId,
        name,
      },
      select: playlistIdentitySelect,
    });

    return playlist;
  }

  async createLiked(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.playlist.create({
      data: { ownerId: userId, name: 'Liked Songs', type: PlaylistType.LIKED },
    });
  }

  async findPlaylistRecord(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PlaylistIdentity> {
    const client = tx ?? this.prisma;
    const playlist = await client.playlist.findUnique({
      where: { id },
      select: playlistIdentitySelect,
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return playlist;
  }

  async findLikedRecord(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PlaylistIdentity> {
    const client = tx ?? this.prisma;
    const playlist = await client.playlist.findFirst({
      where: { ownerId: userId, type: PlaylistType.LIKED },
      select: playlistIdentitySelect,
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return playlist;
  }

  async find(id: string): Promise<Playlist> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      select: playlistSelect,
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return this.enrichWithCovers(playlist);
  }

  async findLiked(userId: string): Promise<Playlist> {
    const playlist = await this.prisma.playlist.findFirst({
      where: { ownerId: userId, type: PlaylistType.LIKED },
      select: playlistSelect,
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return this.enrichWithCovers(playlist);
  }

  async findAll(
    userId: string,
    options: PlaylistQueryOptions,
  ): Promise<PlaylistSummary[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);

    const requestedLimit = options.pagination?.limit ?? 100;
    const take = Math.min(Math.max(requestedLimit, 1), 200);
    const skip = Math.max(options.pagination?.offset ?? 0, 0);

    const playlists = await this.prisma.playlist.findMany({
      where,
      select: playlistSummarySelect,
      orderBy,
      take,
      skip,
    });

    const allAlbumIds = [
      ...new Set(
        playlists.flatMap((playlist) =>
          this.getUniqueAlbumIds(playlist.tracks),
        ),
      ),
    ];

    const coverByAlbumId =
      await this.albumService.findAlbumCoverMap(allAlbumIds);

    return playlists.map((playlist) => {
      const uniqueAlbumIds = this.getUniqueAlbumIds(playlist.tracks);
      const albumCoverUrls = uniqueAlbumIds
        .map((id) => coverByAlbumId.get(id))
        .filter((url): url is string => url !== undefined);

      return {
        id: playlist.id,
        name: playlist.name,
        type: playlist.type,
        albumCoverUrls,
      };
    });
  }

  async findPlaylistCovers(id: string): Promise<string[]> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      select: {
        tracks: {
          select: { track: { select: { albumId: true } } },
        },
      },
    });

    if (!playlist) {
      return [];
    }

    const uniqueAlbumIds = this.getUniqueAlbumIds(playlist.tracks);
    const albumCoverUrls =
      await this.albumService.findAlbumCoverMap(uniqueAlbumIds);

    return [...albumCoverUrls.values()];
  }

  async update(userId: string, id: string, name: string): Promise<void> {
    const result = await this.prisma.playlist.updateMany({
      where: { id, ownerId: userId },
      data: { name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.playlist.deleteMany({
      where: { id, ownerId: userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async addTrack(
    userId: string,
    playlist_id: string,
    trackId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const playlist = await this.findPlaylistRecord(playlist_id, tx);

    if (playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const track = await client.track.findUnique({
      where: { id: trackId },
      select: { id: true },
    });

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    const lastPlaylistTrack = await client.playlistTrack.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = lastPlaylistTrack ? lastPlaylistTrack.position + 1 : 0;

    await client.playlistTrack.create({
      data: {
        playlistId: playlist.id,
        trackId: track.id,
        position: nextPosition,
      },
    });
  }

  async findTracks(
    userId: string,
    playlistId: string,
  ): Promise<PlaylistTrack[]> {
    const playlist = await this.findPlaylistRecord(playlistId);

    if (playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const playlistTracks = await this.prisma.playlistTrack.findMany({
      where: { playlistId: playlist.id },
      select: playlistTrackSelect,
      orderBy: { position: 'asc' },
    });

    return playlistTracks.map(({ track, id }) => {
      return {
        id,
        trackId: track.id,
        genres: track.genres,
        duration: track.duration,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        title: track.title,
        artists: track.trackArtists.map((ta) => ta.artist),
        album: track.album,
      };
    });
  }

  async findTrack(
    userId: string,
    playlistId: string,
    trackId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PlaylistTrack> {
    const client = tx ?? this.prisma;
    const playlist = await this.findPlaylistRecord(playlistId, tx);

    if (playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const playlistTrack = await client.playlistTrack.findFirst({
      where: { playlistId, trackId },
      select: playlistTrackSelect,
    });

    if (!playlistTrack) {
      throw new NotFoundException('Playlist track not found');
    }

    const track = playlistTrack.track;

    return {
      id: playlistTrack.id,
      trackId: track.id,
      title: track.title,
      genres: track.genres,
      duration: track.duration,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      artists: track.trackArtists.map((ta) => ta.artist),
      album: track.album,
    };
  }

  async deleteTrack(
    userId: string,
    playlistId: string,
    trackId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const playlistTrack = await this.findTrack(userId, playlistId, trackId, tx);

    await client.playlistTrack.delete({
      where: { id: playlistTrack.id },
    });
  }

  private async enrichWithCovers(playlist: PlaylistRow): Promise<Playlist> {
    const uniqueAlbumIds = this.getUniqueAlbumIds(playlist.tracks);
    const albumCoverUrls =
      await this.albumService.findAlbumCoverMap(uniqueAlbumIds);

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      ownerId: playlist.ownerId,
      type: playlist.type,
      albumCoverUrls: [...albumCoverUrls.values()],
    };
  }

  private buildWhere(
    filters: PlaylistFilters | undefined,
    userId: string,
  ): Prisma.PlaylistWhereInput {
    const where: Prisma.PlaylistWhereInput = { ownerId: userId };
    if (!filters) return where;

    if (filters.onlyUser === true) {
      where.type = 'USER';
    }

    return where;
  }

  private static readonly SORT_FIELD_MAP: Record<
    PlaylistOrderOptions['order'],
    (direction: Prisma.SortOrder) => Prisma.PlaylistOrderByWithRelationInput
  > = {
    name: (direction) => ({ name: direction }),
    added: (direction) => ({ createdAt: direction }),
  };

  private buildOrderBy(
    orderOptions?: PlaylistOrderOptions,
  ): Prisma.PlaylistOrderByWithRelationInput {
    const ordering = orderOptions ?? { order: 'name', orderBy: 'asc' };
    const orderBy = PlaylistsService.SORT_FIELD_MAP[ordering.order];
    return orderBy(ordering.orderBy);
  }

  private getUniqueAlbumIds(playlistTracks: PlaylistTracksRow): string[] {
    if (!playlistTracks) return [];
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const playlistTrack of playlistTracks) {
      const albumId = playlistTrack.track.albumId;
      if (seen.has(albumId)) continue;
      seen.add(albumId);
      unique.push(albumId);
      if (unique.length === 4) break;
    }

    return unique;
  }
}
