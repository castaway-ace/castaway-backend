import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  albumInteractionSelect,
  artistInteractionSelect,
  Interaction,
  InteractionType,
  playlistInteractionSelect,
} from '../types/interactions.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../types/storage.js';

@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistService: PlaylistsService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(userId: string, limit = 20): Promise<Interaction[]> {
    const [artistInteractions, playlistInteractions, albumInteractions] =
      await Promise.all([
        this.prisma.artistInteraction.findMany({
          where: { userId },
          select: artistInteractionSelect,
          take: limit,
        }),
        this.prisma.playlistInteraction.findMany({
          where: { userId },
          select: playlistInteractionSelect,
          take: limit,
        }),
        this.prisma.albumInteraction.findMany({
          where: { userId },
          select: albumInteractionSelect,
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

    return Promise.all(
      survivors.map(async (candidate): Promise<Interaction> => {
        switch (candidate.kind) {
          case InteractionType.ARTIST: {
            const { artist, ...rest } = candidate.raw;
            return {
              ...rest,
              type: InteractionType.ARTIST,
              name: artist.name,
              coverUrl: artist.imageKey
                ? await this.storageService.getPresignedUrl(
                    StorageBucket.ArtistArt,
                    artist.imageKey,
                  )
                : null,
            };
          }
          case InteractionType.ALBUM: {
            const { album, ...rest } = candidate.raw;
            return {
              ...rest,
              type: InteractionType.ALBUM,
              title: album.title,
              artists: album.albumArtists.map((aa) => aa.artist),
              coverUrl: album.imageKey
                ? await this.storageService.getPresignedUrl(
                    StorageBucket.AlbumArt,
                    album.imageKey,
                  )
                : null,
            };
          }
          case InteractionType.PLAYLIST: {
            const { playlist, ...rest } = candidate.raw;
            const found = await this.playlistService.find(playlist.id);
            return {
              ...rest,
              type: InteractionType.PLAYLIST,
              name: found.name,
              coverUrls: found.albumCoverUrls,
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
