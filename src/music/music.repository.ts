import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AlbumWithArtist, Artist } from './music.types.js';

@Injectable()
export class MusicRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== AUDIO FILE ====================

  /**
   * Find an audio file by its checksum
   */
  async findAudioFileByChecksum(checksum: string) {
    return this.prisma.audioFile.findUnique({
      where: { checksum },
      include: {
        track: true,
      },
    });
  }

  // ==================== TRACKS ====================

  /**
   * Find tracks by metadata (title and album) with artist relations
   */
  async findTracksByMetadata(title: string, albumTitle: string) {
    return this.prisma.track.findMany({
      where: {
        title,
        album: {
          title: albumTitle,
        },
      },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
      },
    });
  }

  /**
   * Find tracks with optional filtering and pagination
   */
  async findTracks(
    where: Prisma.TrackWhereInput,
    options?: {
      take?: number;
      skip?: number;
    },
  ) {
    return this.prisma.track.findMany({
      where,
      include: {
        album: {
          include: {
            artist: true,
          },
        },
        artists: {
          include: {
            artist: true,
          },
        },
        audioFile: true,
      },
      orderBy: [
        { album: { title: 'asc' } },
        { discNumber: 'asc' },
        { trackNumber: 'asc' },
      ],
      take: options?.take || 50,
      skip: options?.skip || 0,
    });
  }

  /**
   * Find a single track by ID with all relations
   */
  async findTrackById(id: string) {
    return this.prisma.track.findUnique({
      where: { id },
      include: {
        album: {
          include: {
            artist: true,
          },
        },
        artists: {
          include: {
            artist: true,
          },
        },
        audioFile: true,
      },
    });
  }

  /**
   * Update track play statistics
   */
  async updateTrackPlayStats(trackId: string) {
    return this.prisma.track.update({
      where: { id: trackId },
      data: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date(),
      },
    });
  }

  // ==================== ARTISTS ====================

  /**
   * Find all artists with album and track counts
   */
  async findAllArtists() {
    return this.prisma.artist.findMany({
      include: {
        albums: {
          include: {
            tracks: true,
          },
        },
        tracks: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findArtistById(artistId: string) {
    return this.prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        albums: {
          include: {
            tracks: {
              include: {
                audioFile: true,
              },
            },
          },
          orderBy: {
            releaseYear: 'asc',
          },
        },
      },
    });
  }

  // ==================== ALBUMS ====================

  /**
   * Find an album by ID with optional select/include
   */
  async findAlbumById(
    albumId: string,
    options?: {
      include?: Prisma.AlbumInclude;
      select?: Prisma.AlbumSelect;
    },
  ) {
    return this.prisma.album.findUnique({
      where: { id: albumId },
      ...options,
    });
  }

  /**
   * Find an album by ID with full relations (tracks, artists, etc.)
   */
  async findAlbumWithTracks(albumId: string) {
    return this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        artist: true,
        tracks: {
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
            audioFile: true,
          },
          orderBy: [{ discNumber: 'asc' }, { trackNumber: 'asc' }],
        },
      },
    });
  }

  // ==================== PLAYLISTS ====================

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

  // ==================== USER LIBRARY ====================

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

  // ==================== LISTENING HISTORY ====================

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

  /**
   * Get play statistics for a track
   */
  async getTrackStats(trackId: string) {
    const [track, historyCount] = await Promise.all([
      this.prisma.track.findUnique({
        where: { id: trackId },
        select: {
          playCount: true,
          lastPlayedAt: true,
        },
      }),
      this.prisma.listeningHistory.count({
        where: { trackId },
      }),
    ]);

    return {
      trackId,
      playCount: track?.playCount ?? 0,
      lastPlayedAt: track?.lastPlayedAt,
      historyCount,
    };
  }

  // ==================== QUEUE ====================

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

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(
    query: string,
    type: 'all' | 'track' | 'artist' | 'album' = 'all',
  ) {
    const searchTerm = query.trim();

    if (type === 'track' || type === 'all') {
      const tracks = await this.prisma.track.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            {
              artists: {
                some: {
                  artist: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              album: {
                title: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        },
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
        take: 20,
      });

      if (type === 'track') {
        return { tracks };
      }
    }

    if (type === 'artist' || type === 'all') {
      const artists = await this.prisma.artist.findMany({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' },
        },
        include: {
          albums: true,
          tracks: true,
        },
        take: 10,
      });

      if (type === 'artist') {
        return { artists };
      }
    }

    if (type === 'album' || type === 'all') {
      const albums = await this.prisma.album.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            {
              artist: {
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        },
        include: {
          artist: true,
          tracks: true,
        },
        take: 10,
      });

      if (type === 'album') {
        return { albums };
      }
    }

    // Return all if type is 'all'
    const [tracks, artists, albums] = await Promise.all([
      this.prisma.track.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            {
              artists: {
                some: {
                  artist: {
                    name: { contains: searchTerm, mode: 'insensitive' },
                  },
                },
              },
            },
            {
              album: {
                title: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        },
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
        take: 20,
      }),
      this.prisma.artist.findMany({
        where: {
          name: { contains: searchTerm, mode: 'insensitive' },
        },
        include: {
          albums: true,
          tracks: true,
        },
        take: 10,
      }),
      this.prisma.album.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            {
              artist: {
                name: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        },
        include: {
          artist: true,
          tracks: true,
        },
        take: 10,
      }),
    ]);

    return { tracks, artists, albums };
  }

  // ==================== TRACK CREATION ====================

  /**
   * Create a complete track with all relations in a transaction
   */
  async createTrackWithRelations(data: {
    metadata: {
      title: string;
      album: string;
      albumArtist: string;
      artists: string[];
      trackNumber: number | null;
      discNumber: number | null;
      releaseYear: number | null;
      genre: string | null;
      duration: number;
      format: string;
      bitrate: number | null;
      sampleRate: number | null;
    };
    audioKey: string;
    albumArtKey: string | undefined;
    checksum: string;
    fileSize: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create or find album artist
      const albumArtist = await tx.artist.upsert({
        where: { name: data.metadata.albumArtist },
        update: {},
        create: { name: data.metadata.albumArtist },
      });

      // 2. Create or find album
      const album = await tx.album.upsert({
        where: {
          title_artistId: {
            title: data.metadata.album,
            artistId: albumArtist.id,
          },
        },
        update: {
          genre: data.metadata.genre ?? undefined,
          albumArtKey: data.albumArtKey ?? undefined,
          releaseYear: data.metadata.releaseYear ?? undefined,
        },
        create: {
          title: data.metadata.album,
          artistId: albumArtist.id,
          releaseYear: data.metadata.releaseYear,
          genre: data.metadata.genre,
          albumArtKey: data.albumArtKey,
        },
      });

      // 3. Create or find track artists
      const trackArtists = await Promise.all(
        data.metadata.artists.map((name: string) =>
          tx.artist.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        ),
      );

      // 4. Create track
      const track = await tx.track.create({
        data: {
          title: data.metadata.title,
          albumId: album.id,
          trackNumber: data.metadata.trackNumber,
          discNumber: data.metadata.discNumber,
          duration: data.metadata.duration,
        },
      });

      // 5. Create track-artist relationships
      await Promise.all(
        trackArtists.map((artist, index) =>
          tx.trackArtist.create({
            data: {
              trackId: track.id,
              artistId: artist.id,
              order: index,
            },
          }),
        ),
      );

      // 6. Create audio file record
      await tx.audioFile.create({
        data: {
          trackId: track.id,
          storageKey: data.audioKey,
          format: data.metadata.format,
          bitrate: data.metadata.bitrate,
          sampleRate: data.metadata.sampleRate,
          fileSize: BigInt(data.fileSize),
          checksum: data.checksum,
        },
      });

      return track;
    });
  }
}
