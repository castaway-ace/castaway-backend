import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Track } from '../generated/prisma/client.js';
import {
  AlbumArtInfo,
  AlbumItem,
  AlbumListItem,
  ArtistWithAlbums,
  ArtistWithCounts,
  AudioFileWithTrackVisibility,
  SearchResults,
  TrackItemWithRelations,
  TrackStats,
  TrackWithRelations,
} from './music.types.js';

@Injectable()
export class MusicRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== AUDIO FILE ====================

  /**
   * Find an audio file by its checksum
   */
  async findAudioFileByChecksum(
    checksum: string,
  ): Promise<AudioFileWithTrackVisibility | null> {
    return this.prisma.audioFile.findUnique({
      where: { checksum },
      include: {
        track: true,
      },
    });
  }

  async findAudioFileByStorageKey(
    storageKey: string,
  ): Promise<AudioFileWithTrackVisibility | null> {
    return this.prisma.audioFile.findUnique({
      where: { storageKey },
      include: {
        track: true,
      },
    });
  }

  // ==================== TRACKS ====================

  /**
   * Find tracks by metadata (title and album) with artist relations
   */
  async findTracksByMetadata(
    title: string,
    albumTitle: string,
  ): Promise<TrackItemWithRelations[]> {
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
        album: {
          select: {
            id: true,
            title: true,
            albumArtKey: true,
          },
        },
      },
      orderBy: [{ album: { title: 'asc' } }],
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
  ): Promise<TrackItemWithRelations[]> {
    return this.prisma.track.findMany({
      where,
      select: {
        id: true,
        title: true,
        duration: true,
        artists: {
          select: {
            artist: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        album: {
          select: {
            id: true,
            title: true,
            albumArtKey: true,
          },
        },
      },
      orderBy: [{ album: { title: 'asc' } }],
      take: options?.take || 50,
      skip: options?.skip || 0,
    });
  }

  /**
   * Find a single track by ID with all relations
   */
  async findTrackById(id: string): Promise<TrackWithRelations | null> {
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
        audioFile: { select: { storageKey: true, mimeType: true, size: true } },
      },
    });
  }

  /**
   * Get play statistics for a track
   */
  async getTrackStats(trackId: string): Promise<TrackStats> {
    const totalPlays = await this.prisma.listeningHistory.count({
      where: { trackId },
    });

    return {
      trackId,
      totalPlays,
    };
  }

  /**
   * Count tracks by where clause
   */
  async countTracks(where: Prisma.TrackWhereInput): Promise<number> {
    return this.prisma.track.count({ where });
  }

  // ==================== ARTISTS ====================

  /**
   * Find all artists with album and track counts
   */
  async findArtists(
    where: Prisma.ArtistWhereInput,
    options?: { take?: number; skip?: number },
  ): Promise<ArtistWithCounts[]> {
    return this.prisma.artist.findMany({
      where,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            albums: true,
            tracks: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: options?.take || 50,
      skip: options?.skip || 0,
    });
  }

  async findArtistById(artistId: string): Promise<ArtistWithAlbums | null> {
    return this.prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        albums: {
          include: {
            tracks: {
              select: {
                duration: true,
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

  /**
   * Count artists by where clause
   */
  async countArtists(where: Prisma.ArtistWhereInput): Promise<number> {
    return this.prisma.artist.count({ where });
  }

  // ==================== ALBUMS ====================

  /**
   * Find all albums with tracks and artists
   */
  async findAllAlbums(options?: {
    take?: number;
    skip?: number;
  }): Promise<AlbumListItem[]> {
    return this.prisma.album.findMany({
      select: {
        id: true,
        title: true,
        releaseYear: true,
        genre: true,
        albumArtKey: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            tracks: true,
          },
        },
      },
      orderBy: { title: 'asc' },
      take: options?.take ?? 50,
      skip: options?.skip ?? 0,
    });
  }

  async countAlbums(): Promise<number> {
    return this.prisma.album.count();
  }

  async findAlbumArt(albumId: string): Promise<AlbumArtInfo | null> {
    return this.prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, albumArtKey: true },
    });
  }

  /**
   * Find an album by ID with full relations (tracks, artists, etc.)
   */
  async findAlbumById(albumId: string): Promise<AlbumItem | null> {
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

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(
    query: string,
    type: 'all' | 'track' | 'artist' | 'album' = 'all',
  ): Promise<SearchResults> {
    const searchTerm = query.trim();
    const results: SearchResults = {};

    const shouldSearchTracks = type === 'all' || type === 'track';
    const shouldSearchArtists = type === 'all' || type === 'artist';
    const shouldSearchAlbums = type === 'all' || type === 'album';

    const promises: Promise<void>[] = [];

    if (shouldSearchTracks) {
      promises.push(
        this.prisma.track
          .findMany({
            where: {
              OR: [
                { title: { contains: searchTerm, mode: 'insensitive' } },
                {
                  artists: {
                    some: {
                      artist: {
                        name: {
                          contains: searchTerm,
                          mode: 'insensitive',
                        },
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
              audioFile: {
                select: {
                  storageKey: true,
                  mimeType: true,
                  size: true,
                },
              },
            },
            take: 20,
          })
          .then((tracks) => {
            results.tracks = tracks;
          }),
      );
    }

    if (shouldSearchArtists) {
      promises.push(
        this.prisma.artist
          .findMany({
            where: {
              name: { contains: searchTerm, mode: 'insensitive' },
            },
            include: {
              _count: {
                select: {
                  albums: true,
                  tracks: true,
                },
              },
            },
            take: 10,
          })
          .then((artists) => {
            results.artists = artists;
          }),
      );
    }

    if (shouldSearchAlbums) {
      promises.push(
        this.prisma.album
          .findMany({
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
              _count: {
                select: {
                  tracks: true,
                },
              },
            },
            take: 10,
          })
          .then((albums) => {
            results.albums = albums;
          }),
      );
    }

    await Promise.all(promises);

    return results;
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
      mimeType: string;
      bitrate: number | null;
      sampleRate: number | null;
    };
    audioKey: string;
    albumArtKey: string | undefined;
    checksum: string;
    size: number;
  }): Promise<Track> {
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
          mimeType: data.metadata.mimeType,
          bitrate: data.metadata.bitrate,
          sampleRate: data.metadata.sampleRate,
          size: BigInt(data.size),
          checksum: data.checksum,
        },
      });

      return track;
    });
  }
}
