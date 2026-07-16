import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistType, Prisma } from '../generated/prisma/client.js';
import { AlbumsService } from '../albums/albums.service.js';
import {
  PlaylistEntity,
  PlaylistSummaryEntity,
  PlaylistTrackEntity,
} from './playlist.entity.js';
import {
  PlaylistIdentity,
  playlistIdentitySelect,
  playlistSelect,
  playlistSummarySelect,
  playlistTrackSelect,
  PlaylistRow,
  PlaylistTracksRow,
} from './playlists.types.js';
import { PlaylistOrderOptions } from './dto/playlist-query.dto.js';
import { PlaylistRef } from '../common/entities/references.entity.js';
import { buildOrderBy, clampPagination } from '../common/query.js';
import { toArtistRef } from '../common/artist-ref.js';

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

  async create(userId: string, name: string): Promise<PlaylistRef> {
    return await this.prisma.playlist.create({
      data: {
        ownerId: userId,
        name,
      },
      select: { id: true, name: true },
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

  async find(userId: string, id: string): Promise<PlaylistEntity> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      select: playlistSelect,
    });

    if (!playlist || playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    return this.enrichWithCovers(playlist);
  }

  async findLiked(userId: string): Promise<PlaylistEntity> {
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
  ): Promise<PlaylistSummaryEntity[]> {
    const where = this.buildWhere(options.filters, userId);
    const orderBy = this.buildOrderBy(options?.orderOptions);
    const { take, skip } = clampPagination(options.pagination);

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

  /**
   * Resolves cover tiles for many playlists at once, keyed by playlist id.
   *
   * @remarks
   * The batched counterpart to {@link findPlaylistCovers}: every playlist's
   * album ids are gathered up front and presigned through a single
   * {@link AlbumsService.findAlbumCoverMap} call, so resolving a whole list
   * costs two queries instead of two per playlist. Callers rendering more than
   * one playlist should prefer this.
   *
   * Playlists with no resolvable art still get an entry (an empty array), so a
   * caller can map over its ids without a missing-key branch.
   */
  async findPlaylistCoverMap(ids: string[]): Promise<Map<string, string[]>> {
    if (!ids.length) return new Map();

    const playlists = await this.prisma.playlist.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        tracks: {
          select: { track: { select: { albumId: true } } },
        },
      },
    });

    const albumIdsByPlaylist = new Map(
      playlists.map((playlist) => [
        playlist.id,
        this.getUniqueAlbumIds(playlist.tracks),
      ]),
    );

    const coverByAlbumId = await this.albumService.findAlbumCoverMap([
      ...new Set([...albumIdsByPlaylist.values()].flat()),
    ]);

    return new Map(
      ids.map((id) => [
        id,
        (albumIdsByPlaylist.get(id) ?? [])
          .map((albumId) => coverByAlbumId.get(albumId))
          .filter((url): url is string => url !== undefined),
      ]),
    );
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
      where: { id, ownerId: userId, type: PlaylistType.USER },
      data: { name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.playlist.deleteMany({
      where: { id, ownerId: userId, type: PlaylistType.USER },
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
    if (tx) {
      return this.addTrackWithClient(userId, playlist_id, trackId, tx);
    }

    return this.prisma.$transaction((client) =>
      this.addTrackWithClient(userId, playlist_id, trackId, client),
    );
  }

  private async addTrackWithClient(
    userId: string,
    playlist_id: string,
    trackId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const playlist = await this.findPlaylistRecord(playlist_id, client);

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

    await client.$queryRaw`SELECT id FROM playlists WHERE id = ${playlist.id}::uuid FOR UPDATE`;

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
  ): Promise<PlaylistTrackEntity[]> {
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
        artists: track.trackArtists.map((ta) => toArtistRef(ta.artist)),
        album: track.album,
      };
    });
  }

  async findTrack(
    userId: string,
    playlistId: string,
    trackId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PlaylistTrackEntity> {
    const client = tx ?? this.prisma;
    const playlist = await this.findPlaylistRecord(playlistId, tx);

    if (playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const playlistTrack = await client.playlistTrack.findFirst({
      where: { playlistId, trackId },
      select: playlistTrackSelect,
      orderBy: { position: 'desc' },
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
      artists: track.trackArtists.map((ta) => toArtistRef(ta.artist)),
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

  private async enrichWithCovers(
    playlist: PlaylistRow,
  ): Promise<PlaylistEntity> {
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
  ): Prisma.PlaylistOrderByWithRelationInput[] {
    return buildOrderBy(
      PlaylistsService.SORT_FIELD_MAP,
      { id: 'asc' },
      { order: 'name', orderBy: 'asc' },
      orderOptions,
    );
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
