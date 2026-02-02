import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  AlbumWithTracks,
  ArtistWithAlbums,
  AudioFileWithTrackVisibility,
} from './music.types.js';

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
   * Find audio file by storage key with track visibility
   */
  async findAudioFileByStorageKey(
    storageKey: string,
  ): Promise<AudioFileWithTrackVisibility | null> {
    return this.prisma.audioFile.findUnique({
      where: { storageKey },
      include: {
        track: {
          select: {
            id: true,
            isPublic: true,
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

  /**
   * Update track visibility
   */
  async updateTrackVisibility(trackId: string, isPublic: boolean) {
    return this.prisma.track.update({
      where: { id: trackId },
      data: { isPublic },
      select: {
        id: true,
        title: true,
        isPublic: true,
      },
    });
  }

  // ==================== ARTISTS ====================

  /**
   * Find all artists with album and track counts
   */
  async findAllArtists(userId?: string) {
    const where: Prisma.ArtistWhereInput = {};

    // If not authenticated, only show artists with public tracks
    if (!userId) {
      where.tracks = {
        some: {
          track: {
            isPublic: true,
          },
        },
      };
    }

    return this.prisma.artist.findMany({
      where,
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

  async findArtistById(
    artistId: string,
    userId?: string,
  ): Promise<ArtistWithAlbums | null> {
    const where: Prisma.AlbumWhereInput = {};

    // If not authenticated, only show albums with public tracks
    if (!userId) {
      where.tracks = {
        some: {
          isPublic: true,
        },
      };
    }

    return this.prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        albums: {
          where,
          include: {
            tracks: {
              where: userId ? {} : { isPublic: true },
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
  async findAlbumWithTracks(
    albumId: string,
    userId?: string,
  ): Promise<AlbumWithTracks | null> {
    const trackWhere: Prisma.TrackWhereInput = {};

    // If not authenticated, only show public tracks
    if (!userId) {
      trackWhere.isPublic = true;
    }

    return this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        artist: true,
        tracks: {
          where: trackWhere,
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

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(
    query: string,
    type: 'all' | 'track' | 'artist' | 'album' = 'all',
    userId?: string,
  ) {
    const searchTerm = query.trim();

    const trackWhere: Prisma.TrackWhereInput = userId ? {} : { isPublic: true };
    const artistWhere: Prisma.ArtistWhereInput = userId
      ? {}
      : {
          tracks: {
            some: {
              track: {
                isPublic: true,
              },
            },
          },
        };
    const albumWhere: Prisma.AlbumWhereInput = userId
      ? {}
      : {
          tracks: {
            some: {
              isPublic: true,
            },
          },
        };

    if (type === 'track' || type === 'all') {
      const tracks = await this.prisma.track.findMany({
        where: {
          ...trackWhere,
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
          ...artistWhere,
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
          ...albumWhere,
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
          ...trackWhere,
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
          ...artistWhere,
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
          ...albumWhere,
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
