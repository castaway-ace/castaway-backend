import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  albumInteractionSelect,
  artistInteractionSelect,
  Interaction,
  InteractionType,
  playlistInteractionSelect,
} from './interactions.types.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';

const DEFAULT_INTERACTION_LIMIT = 20;

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistService: PlaylistsService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  async findAll(
    userId: string,
    limit = DEFAULT_INTERACTION_LIMIT,
  ): Promise<Interaction[]> {
    const [artistInteractions, playlistInteractions, albumInteractions] =
      await Promise.all([
        this.prisma.artistInteraction.findMany({
          where: { userId },
          select: artistInteractionSelect,
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        this.prisma.playlistInteraction.findMany({
          where: { userId },
          select: playlistInteractionSelect,
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        this.prisma.albumInteraction.findMany({
          where: { userId },
          select: albumInteractionSelect,
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
      ]);

    const candidates = [
      ...artistInteractions.map((raw) => ({
        kind: InteractionType.ARTIST as const,
        raw,
      })),
      ...playlistInteractions.map((raw) => ({
        kind: InteractionType.PLAYLIST as const,
        raw,
      })),
      ...albumInteractions.map((raw) => ({
        kind: InteractionType.ALBUM as const,
        raw,
      })),
    ];

    candidates.sort(
      (a, b) => b.raw.updatedAt.getTime() - a.raw.updatedAt.getTime(),
    );

    const survivors = candidates.slice(0, limit);

    const albumIds = survivors.flatMap((candidate) =>
      candidate.kind === InteractionType.ALBUM ? [candidate.raw.album.id] : [],
    );
    const artistIds = survivors.flatMap((candidate) =>
      candidate.kind === InteractionType.ARTIST
        ? [candidate.raw.artist.id]
        : [],
    );

    const [albumCovers, artistImages] = await Promise.all([
      albumIds.length
        ? this.albumService.findAlbumCoverMap(albumIds)
        : new Map<string, string>(),
      artistIds.length
        ? this.artistService.findArtistImageMap(artistIds)
        : new Map<string, string>(),
    ]);

    return Promise.all(
      survivors.map(async (candidate): Promise<Interaction> => {
        switch (candidate.kind) {
          case InteractionType.ARTIST: {
            return {
              ...candidate.raw,
              type: InteractionType.ARTIST,
              coverUrl: artistImages.get(candidate.raw.artist.id) ?? null,
            };
          }
          case InteractionType.ALBUM: {
            const { album, ...rest } = candidate.raw;
            return {
              ...rest,
              type: InteractionType.ALBUM,
              album: {
                id: album.id,
                title: album.title,
              },
              artists: album.albumArtists.map((aa) => aa.artist),
              coverUrl: albumCovers.get(album.id) ?? null,
            };
          }
          case InteractionType.PLAYLIST: {
            const coverUrls = await this.playlistService
              .findPlaylistCovers(candidate.raw.playlist.id)
              .catch((error: unknown): string[] => {
                this.logger.warn(
                  `Failed to resolve covers for playlist ${candidate.raw.playlist.id}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
                return [];
              });
            return {
              ...candidate.raw,
              type: InteractionType.PLAYLIST,
              coverUrls,
            };
          }
        }
      }),
    );
  }

  async createOrUpdateAlbum(userId: string, id: string): Promise<void> {
    await this.prisma.albumInteraction.upsert({
      where: { userId_albumId: { userId, albumId: id } },
      create: { userId, albumId: id },
      update: { updatedAt: new Date() },
    });
  }

  async createOrUpdateArtist(userId: string, id: string): Promise<void> {
    await this.prisma.artistInteraction.upsert({
      where: { userId_artistId: { userId, artistId: id } },
      create: { userId, artistId: id },
      update: { updatedAt: new Date() },
    });
  }

  async createOrUpdatePlaylist(userId: string, id: string): Promise<void> {
    await this.prisma.playlistInteraction.upsert({
      where: { userId_playlistId: { userId, playlistId: id } },
      create: { userId, playlistId: id },
      update: { updatedAt: new Date() },
    });
  }
}
