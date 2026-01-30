import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a track play
   */
  async recordPlay(userId: string, trackId: string, duration?: number) {
    return this.prisma.listeningHistory.create({
      data: {
        userId,
        trackId,
        duration,
      },
    });
  }

  /**
   * Get recent plays for a user
   */
  async getRecentPlays(userId: string, limit: number = 50) {
    return this.prisma.listeningHistory.findMany({
      where: { userId },
      include: {
        track: {
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
            album: {
              include: {
                artist: true,
              },
            },
            audioFile: true,
          },
        },
      },
      orderBy: {
        playedAt: 'desc',
      },
      take: limit,
    });
  }
}
