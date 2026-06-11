import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Interaction } from '../types/interactions.js';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, limit = 20): Promise<Interaction[]> {
    const [artistInteractions, playlistInteractions, albumInteractions] =
      await Promise.all([
        this.prisma.artistInteraction.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        this.prisma.playlistInteraction.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
        this.prisma.albumInteraction.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        }),
      ]);

    const merged = [
      ...artistInteractions.map((i) => ({ type: 'artist', ...i })),
      ...playlistInteractions.map((i) => ({ type: 'playlist', ...i })),
      ...albumInteractions.map((i) => ({ type: 'album', ...i })),
    ];

    merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return merged.slice(0, limit);
  }

  async createOrUpdateAlbum(userId: string, id: string): Promise<void> {
    await this.prisma.albumInteraction.upsert({
      where: { albumId_userId: { userId, albumId: id } },
      create: { userId, albumId: id },
      update: {},
    });
  }

  async createOrUpdateArtist(userId: string, id: string): Promise<void> {
    await this.prisma.artistInteraction.upsert({
      where: { artistId_userId: { userId, artistId: id } },
      create: { userId, artistId: id },
      update: {},
    });
  }

  async createOrUpdatePlaylist(userId: string, id: string): Promise<void> {
    await this.prisma.playlistInteraction.upsert({
      where: { playlistId_userId: { userId, playlistId: id } },
      create: { userId, playlistId: id },
      update: {},
    });
  }
}
