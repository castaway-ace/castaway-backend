import { Injectable } from '@nestjs/common';
import { QueueRepository } from './queue.repository.js';
import { formatTrackResponse } from '../common/formatters/track.formatter.js';
import { TrackWithRelations } from './queue.types.js';

@Injectable()
export class QueueService {
  constructor(private readonly queueRepository: QueueRepository) {}
  /**
   * Get user queue
   */
  async getQueue(userId: string) {
    const queue = await this.queueRepository.getOrCreateQueue(userId);

    return {
      currentTrack: queue.currentTrack
        ? formatTrackResponse(queue.currentTrack)
        : null,
      position: queue.position,
      shuffleEnabled: queue.shuffleEnabled,
      repeatMode: queue.repeatMode,
      items: queue.queueItems.map(
        (item: {
          id: string;
          position: number;
          track: TrackWithRelations;
        }) => ({
          id: item.id,
          position: item.position,
          track: formatTrackResponse(item.track),
        }),
      ),
    };
  }

  /**
   * Set queue from source (playlist, album, or track list)
   */
  async setQueue(userId: string, trackIds: string[], currentTrackId?: string) {
    await this.queueRepository.setQueueItems(userId, trackIds);

    if (currentTrackId) {
      await this.queueRepository.updateQueue(userId, {
        currentTrackId,
        position: 0,
      });
    }

    return {
      message: 'Queue set successfully',
    };
  }

  /**
   * Update queue state
   */
  async updateQueue(
    userId: string,
    data: {
      currentTrackId?: string;
      position?: number;
      shuffleEnabled?: boolean;
      repeatMode?: 'OFF' | 'ONE' | 'ALL';
    },
  ) {
    await this.queueRepository.updateQueue(userId, data);

    return {
      message: 'Queue updated',
    };
  }

  /**
   * Add tracks to queue
   */
  async addToQueue(userId: string, trackIds: string[]) {
    await this.queueRepository.addToQueue(userId, trackIds);

    return {
      message: `Added ${trackIds.length} tracks to queue`,
    };
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(itemId: string) {
    await this.queueRepository.removeFromQueue(itemId);

    return {
      message: 'Item removed from queue',
    };
  }

  /**
   * Reorder queue items
   */
  async reorderQueue(updates: Array<{ id: string; position: number }>) {
    await this.queueRepository.reorderQueue(updates);

    return {
      message: 'Queue reordered successfully',
    };
  }
}
