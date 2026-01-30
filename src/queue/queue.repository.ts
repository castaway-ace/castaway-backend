import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class QueueRepository {
  constructor(private readonly prisma: PrismaService) {}
  async getOrCreateQueue(userId: string) {
    let queue = await this.prisma.playbackQueue.findUnique({
      where: { userId },
      include: {
        currentTrack: {
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
        queueItems: {
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
            position: 'asc',
          },
        },
      },
    });

    if (!queue) {
      queue = await this.prisma.playbackQueue.create({
        data: {
          userId,
        },
        include: {
          currentTrack: {
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
          queueItems: {
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
              position: 'asc',
            },
          },
        },
      });
    }

    return queue;
  }

  /**
   * Update queue state
   */
  async updateQueue(
    userId: string,
    data: {
      currentTrackId?: string | null;
      position?: number;
      shuffleEnabled?: boolean;
      repeatMode?: 'OFF' | 'ONE' | 'ALL';
    },
  ) {
    return this.prisma.playbackQueue.update({
      where: { userId },
      data,
    });
  }

  /**
   * Set queue items (replaces existing queue)
   */
  async setQueueItems(userId: string, trackIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Delete existing queue items
      await tx.queueItem.deleteMany({
        where: {
          queue: {
            userId,
          },
        },
      });

      // Get queue
      const queue = await tx.playbackQueue.findUnique({
        where: { userId },
      });

      if (!queue) {
        throw new Error('Queue not found');
      }

      // Create new queue items
      await tx.queueItem.createMany({
        data: trackIds.map((trackId, index) => ({
          queueId: queue.id,
          trackId,
          position: index,
        })),
      });
    });
  }

  /**
   * Add tracks to queue
   */
  async addToQueue(userId: string, trackIds: string[]) {
    const queue = await this.prisma.playbackQueue.findUnique({
      where: { userId },
      include: {
        queueItems: {
          orderBy: {
            position: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!queue) {
      throw new Error('Queue not found');
    }

    const startPosition = (queue.queueItems[0]?.position ?? -1) + 1;

    return this.prisma.queueItem.createMany({
      data: trackIds.map((trackId, index) => ({
        queueId: queue.id,
        trackId,
        position: startPosition + index,
      })),
    });
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(itemId: string) {
    return this.prisma.queueItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Reorder queue items
   */
  async reorderQueue(updates: Array<{ id: string; position: number }>) {
    return this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.queueItem.update({
          where: { id: update.id },
          data: { position: update.position },
        }),
      ),
    );
  }
}
