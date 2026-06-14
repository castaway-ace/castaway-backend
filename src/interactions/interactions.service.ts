import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AlbumInteraction,
  albumInteractionSelect,
  ArtistInteraction,
  artistInteractionSelect,
  Interaction,
  InteractionType,
  PlaylistInteraction,
  playlistInteractionSelect,
} from '../types/interactions.js';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const merged = [
      ...artistInteractions.map(
        (i): ArtistInteraction => ({
          type: InteractionType.ARTIST,
          ...i,
        }),
      ),
      ...playlistInteractions.map(
        (i): PlaylistInteraction => ({
          type: InteractionType.PLAYLIST,
          ...i,
        }),
      ),
      ...albumInteractions.map((i): AlbumInteraction => {
        const { album, ...rest } = i;
        return {
          type: InteractionType.ALBUM,
          ...rest,
          title: album.title,
          artists: album.albumArtists.map((aa) => aa.artist),
        };
      }),
    ];

    merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return merged.slice(0, limit);
  }

  async createOrUpdateAlbum(userId: string, id: string): Promise<void> {
    await this.prisma.albumInteraction.upsert({
      where: { albumId_userId: { userId, albumId: id } },
      create: { userId, albumId: id },
      update: { updatedAt: new Date() },
    });
  }

  async createOrUpdateArtist(userId: string, id: string): Promise<void> {
    await this.prisma.artistInteraction.upsert({
      where: { artistId_userId: { userId, artistId: id } },
      create: { userId, artistId: id },
      update: { updatedAt: new Date() },
    });
  }

  async createOrUpdatePlaylist(userId: string, id: string): Promise<void> {
    await this.prisma.playlistInteraction.upsert({
      where: { playlistId_userId: { userId, playlistId: id } },
      create: { userId, playlistId: id },
      update: { updatedAt: new Date() },
    });
  }
}
