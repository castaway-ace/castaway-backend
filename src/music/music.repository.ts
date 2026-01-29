import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class MusicRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Create a complete track with all relations in a transaction
   * This encapsulates the complex multi-step database operation
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
