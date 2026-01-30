import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlbumWithArtist, Artist } from './library.types.js';

@Injectable()
export class LibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add track to user library
   */
  async addToLibrary(userId: string, trackId: string) {
    return this.prisma.userLibrary.create({
      data: {
        userId,
        trackId,
      },
    });
  }

  /**
   * Remove track from user library
   */
  async removeFromLibrary(userId: string, trackId: string) {
    return this.prisma.userLibrary.delete({
      where: {
        userId_trackId: {
          userId,
          trackId,
        },
      },
    });
  }

  /**
   * Check if track is in user library
   */
  async isInLibrary(userId: string, trackId: string) {
    const entry = await this.prisma.userLibrary.findUnique({
      where: {
        userId_trackId: {
          userId,
          trackId,
        },
      },
    });
    return entry !== null;
  }

  /**
   * Get all tracks in user library
   */
  async getLibraryTracks(
    userId: string,
    options?: { take?: number; skip?: number },
  ) {
    return this.prisma.userLibrary.findMany({
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
        addedAt: 'desc',
      },
      take: options?.take || 50,
      skip: options?.skip || 0,
    });
  }

  /**
   * Get distinct artists from user library
   */
  async getLibraryArtists(userId: string) {
    const libraryTracks = await this.prisma.userLibrary.findMany({
      where: { userId },
      include: {
        track: {
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
          },
        },
      },
    });

    // Extract unique artists
    const artistMap = new Map<string, Artist>();
    for (const entry of libraryTracks) {
      for (const trackArtist of entry.track.artists) {
        if (!artistMap.has(trackArtist.artist.id)) {
          artistMap.set(trackArtist.artist.id, trackArtist.artist);
        }
      }
    }

    return Array.from(artistMap.values());
  }

  /**
   * Get distinct albums from user library
   */
  async getLibraryAlbums(userId: string) {
    const libraryTracks = await this.prisma.userLibrary.findMany({
      where: { userId },
      include: {
        track: {
          include: {
            album: {
              include: {
                artist: true,
              },
            },
          },
        },
      },
    });

    // Extract unique albums
    const albumMap = new Map<string, AlbumWithArtist>();
    for (const entry of libraryTracks) {
      if (!albumMap.has(entry.track.album.id)) {
        albumMap.set(entry.track.album.id, entry.track.album);
      }
    }

    return Array.from(albumMap.values());
  }
}
