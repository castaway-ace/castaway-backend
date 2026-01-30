import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlaylistRepository } from './playlist.repository.js';
import { formatTrackResponse } from '../common/formatters/track.formatter.js';
@Injectable()
export class PlaylistService {
  constructor(private readonly playlistRepository: PlaylistRepository) {}

  /**
   * Get all playlists for a user
   */
  async getPlaylists(userId: string) {
    const playlists = await this.playlistRepository.findAllPlaylists(userId);

    return playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      coverImage: playlist.coverImage,
      trackCount: playlist.tracks.length,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    }));
  }

  /**
   * Get a single playlist with tracks
   */
  async getPlaylist(playlistId: string, userId: string) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    // Check if user has access (owner or public)
    if (playlist.userId !== userId && !playlist.isPublic) {
      throw new ForbiddenException('You do not have access to this playlist');
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      coverImage: playlist.coverImage,
      owner: {
        id: playlist.user.id,
        name: playlist.user.name,
        email: playlist.user.email,
      },
      tracks: playlist.tracks.map((pt) => ({
        playlistTrackId: pt.id,
        position: pt.position,
        addedAt: pt.addedAt,
        track: formatTrackResponse(pt.track),
      })),
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(
    userId: string,
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
    },
  ) {
    const playlist = await this.playlistRepository.createPlaylist({
      userId,
      name: data.name,
      description: data.description,
      isPublic: data.isPublic,
    });

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      createdAt: playlist.createdAt,
    };
  }

  /**
   * Update playlist metadata
   */
  async updatePlaylist(
    playlistId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      coverImage?: string;
    },
  ) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this playlist',
      );
    }

    const updated = await this.playlistRepository.updatePlaylist(
      playlistId,
      data,
    );

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isPublic: updated.isPublic,
      coverImage: updated.coverImage,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string, userId: string) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this playlist',
      );
    }

    await this.playlistRepository.deletePlaylist(playlistId);

    return {
      message: 'Playlist deleted successfully',
    };
  }

  /**
   * Add tracks to playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    userId: string,
    trackIds: string[],
  ) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.playlistRepository.addTracksToPlaylist(playlistId, trackIds);

    return {
      message: `Added ${trackIds.length} tracks to playlist`,
    };
  }

  /**
   * Remove track from playlist
   */
  async removeTrackFromPlaylist(
    playlistId: string,
    trackId: string,
    userId: string,
  ) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.playlistRepository.removeTrackFromPlaylist(playlistId, trackId);

    return {
      message: 'Track removed from playlist',
    };
  }

  /**
   * Reorder tracks in a playlist
   */
  async reorderPlaylistTracks(
    playlistId: string,
    userId: string,
    updates: Array<{ id: string; position: number }>,
  ) {
    const playlist = await this.playlistRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.playlistRepository.reorderPlaylistTracks(updates);

    return {
      message: 'Playlist tracks reordered successfully',
    };
  }
}
