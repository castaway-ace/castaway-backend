import { Injectable, NotFoundException } from '@nestjs/common';
import { HistoryRepository } from './history.repository.js';
import { formatTrackResponse } from '../common/formatters/track.formatter.js';
import { MusicRepository } from '../music/music.repository.js';

@Injectable()
export class HistoryService {
  constructor(
    private readonly historyRepository: HistoryRepository,
    private readonly musicRepository: MusicRepository,
  ) {}

  /**
   * Record a track play
   */
  async recordPlay(userId: string, trackId: string, duration?: number) {
    const track = await this.musicRepository.findTrackById(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    // Record in history
    await this.historyRepository.recordPlay(userId, trackId, duration);

    // Update track play statistics
    await this.musicRepository.updateTrackPlayStats(trackId);

    return {
      message: 'Play recorded',
    };
  }

  /**
   * Get recent plays for user
   */
  async getRecentPlays(userId: string, limit?: number) {
    const history = await this.historyRepository.getRecentPlays(
      userId,
      limit || 50,
    );

    return history.map((entry) => ({
      playedAt: entry.playedAt,
      duration: entry.duration,
      track: formatTrackResponse(entry.track),
    }));
  }

  /**
   * Get play statistics for a track
   */
  async getTrackStats(trackId: string) {
    const stats = await this.musicRepository.getTrackStats(trackId);

    return {
      trackId: stats.trackId,
      playCount: stats.playCount,
      lastPlayedAt: stats.lastPlayedAt,
      totalPlays: stats.historyCount,
    };
  }
}
