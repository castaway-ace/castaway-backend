import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PlaylistRepository {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Find all playlists for a user
   */
  async findAllPlaylists(userId: string) {
    return this.prisma.playlist.findMany({
      where: { userId },
      include: {
        tracks: {
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
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a single playlist by ID with tracks
   */
  async findPlaylistById(playlistId: string) {
    return this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tracks: {
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

  /**
   * Create a new playlist
   */
  async createPlaylist(data: {
    userId: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }) {
    return this.prisma.playlist.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? false,
      },
    });
  }

  /**
   * Update playlist metadata
   */
  async updatePlaylist(
    playlistId: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      coverImage?: string;
    },
  ) {
    return this.prisma.playlist.update({
      where: { id: playlistId },
      data,
    });
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string) {
    return this.prisma.playlist.delete({
      where: { id: playlistId },
    });
  }

  /**
   * Add tracks to playlist
   */
  async addTracksToPlaylist(playlistId: string, trackIds: string[]) {
    // Get the current highest position
    const highestPosition = await this.prisma.playlistTrack.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const startPosition = (highestPosition?.position ?? -1) + 1;

    // Create playlist tracks with sequential positions
    return this.prisma.playlistTrack.createMany({
      data: trackIds.map((trackId, index) => ({
        playlistId,
        trackId,
        position: startPosition + index,
      })),
      skipDuplicates: true, // Skip if track already exists in playlist
    });
  }

  /**
   * Remove a track from a playlist
   */
  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    return this.prisma.playlistTrack.delete({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
    });
  }

  /**
   * Reorder tracks in a playlist
   */
  async reorderPlaylistTracks(
    updates: Array<{ id: string; position: number }>,
  ) {
    return this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.playlistTrack.update({
          where: { id: update.id },
          data: { position: update.position },
        }),
      ),
    );
  }

  /**
   * Get all tracks in a playlist
   */
  async getPlaylistTracks(playlistId: string) {
    return this.prisma.playlistTrack.findMany({
      where: { playlistId },
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
    });
  }
}
