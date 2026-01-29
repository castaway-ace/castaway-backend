import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import * as mm from 'music-metadata';
import { createHash } from 'crypto';
import { Prisma } from 'src/generated/prisma/client.js';

interface UploadResult {
  trackId: string;
  duplicate: boolean;
  message: string;
}

interface TrackFilter {
  artist?: string;
  album?: string;
  limit?: number;
  offset?: number;
}

interface ExtractedMetadata {
  title: string;
  album: string;
  artists: string[];
  albumArtist: string;
  trackNumber: number | null;
  discNumber: number | null;
  releaseYear: number | null;
  genre: string | null;
  duration: number;
  format: string;
  bitrate: number | null;
  sampleRate: number | null;
  picture?: mm.IPicture;
}

@Injectable()
export class MusicService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  /**
   * Upload a track with automatic metadata extraction and storage
   */
  async uploadTrack(file: Express.Multer.File): Promise<UploadResult> {
    // Step 1: Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    // Step 2: Check for exact duplicate (now that checksum is unique)
    const existingFile = await this.prisma.audioFile.findUnique({
      where: { checksum },
      include: {
        track: true,
      },
    });

    if (existingFile) {
      throw new ConflictException(
        `This exact file already exists as track: ${existingFile.track.title}`,
      );
    }

    // Step 3: Extract metadata
    const metadata = await this.extractMetadata(file.buffer, file.mimetype);

    // Step 4: Check for metadata-based duplicates
    const potentialDuplicate = await this.findMetadataDuplicate(metadata);

    if (potentialDuplicate) {
      console.warn(
        `Potential duplicate found: ${metadata.title} by ${metadata.artists.join(', ')}`,
      );
    }

    // Step 5: Upload audio file to MinIO
    const audioUpload = await this.storage.uploadTrack(
      checksum,
      metadata.format,
      file.buffer,
      file.mimetype,
      {
        title: metadata.title,
        artist: metadata.artists.join(', '),
        album: metadata.album,
      },
    );

    // Step 6: Handle album art if present
    let albumArtKey: string | undefined;
    if (metadata.picture) {
      const artUpload = await this.uploadAlbumArt(metadata.picture);
      albumArtKey = artUpload.storageKey;
    }

    // Step 7: Create database records (transaction)
    const track = await this.createTrackWithMetadata(
      metadata,
      audioUpload.storageKey,
      albumArtKey,
      checksum,
      audioUpload.size,
    );

    return {
      trackId: track.id,
      duplicate: !!potentialDuplicate,
      message: potentialDuplicate
        ? 'Uploaded successfully, but similar track exists'
        : 'Uploaded successfully',
    };
  }

  /**
   * Get tracks with optional filtering
   */
  async getTracks(filter: TrackFilter) {
    const where: Prisma.TrackWhereInput = {};

    // Filter by artist name
    if (filter.artist) {
      where.artists = {
        some: {
          artist: {
            name: {
              contains: filter.artist,
              mode: 'insensitive',
            },
          },
        },
      };
    }

    // Filter by album title
    if (filter.album) {
      where.album = {
        title: {
          contains: filter.album,
          mode: 'insensitive',
        },
      };
    }

    const tracks = await this.prisma.track.findMany({
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
      take: filter.limit || 50,
      skip: filter.offset || 0,
    });

    // Transform to clean response format
    return tracks.map((track) => {
      // Sort artists by order in application code
      const sortedArtists = [...track.artists].sort(
        (a, b) => a.order - b.order,
      );

      return {
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        duration: track.duration,
        artists: sortedArtists.map((ta) => ({
          id: ta.artist.id,
          name: ta.artist.name,
        })),
        album: {
          id: track.album.id,
          title: track.album.title,
          releaseYear: track.album.releaseYear,
          genre: track.album.genre,
          albumArtKey: track.album.albumArtKey,
          artist: {
            id: track.album.artist.id,
            name: track.album.artist.name,
          },
        },
        audioFile: track.audioFile
          ? {
              storageKey: track.audioFile.storageKey,
              format: track.audioFile.format,
              bitrate: track.audioFile.bitrate,
              sampleRate: track.audioFile.sampleRate,
              fileSize: track.audioFile.fileSize.toString(),
            }
          : null,
      };
    });
  }

  /**
   * Get a single track by ID
   */
  async getTrack(id: string) {
    const track = await this.prisma.track.findUnique({
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

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    // Sort artists by order in application code
    const sortedArtists = [...track.artists].sort((a, b) => a.order - b.order);

    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      duration: track.duration,
      artists: sortedArtists.map((ta) => ({
        id: ta.artist.id,
        name: ta.artist.name,
      })),
      album: {
        id: track.album.id,
        title: track.album.title,
        releaseYear: track.album.releaseYear,
        genre: track.album.genre,
        albumArtKey: track.album.albumArtKey,
        artist: {
          id: track.album.artist.id,
          name: track.album.artist.name,
        },
      },
      audioFile: track.audioFile
        ? {
            storageKey: track.audioFile.storageKey,
            format: track.audioFile.format,
            bitrate: track.audioFile.bitrate,
            sampleRate: track.audioFile.sampleRate,
            fileSize: track.audioFile.fileSize.toString(),
          }
        : null,
    };
  }

  /**
   * Get all albums
   */
  async getAlbums() {
    const albums = await this.prisma.album.findMany({
      include: {
        artist: true,
        tracks: {
          include: {
            audioFile: true,
          },
        },
      },
      orderBy: [{ artist: { name: 'asc' } }, { releaseYear: 'asc' }],
    });

    return albums.map((album) => ({
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
      trackCount: album.tracks.length,
      totalDuration: album.tracks.reduce(
        (sum, track) => sum + (track.duration || 0),
        0,
      ),
    }));
  }

  /**
   * Get all tracks in an album
   */
  async getAlbumTracks(albumId: string) {
    const album = await this.prisma.album.findUnique({
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

    if (!album) {
      throw new NotFoundException(`Album with ID ${albumId} not found`);
    }

    return {
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
      tracks: album.tracks.map((track) => {
        // Sort artists by order in application code
        const sortedArtists = [...track.artists].sort(
          (a, b) => a.order - b.order,
        );

        return {
          id: track.id,
          title: track.title,
          trackNumber: track.trackNumber,
          discNumber: track.discNumber,
          duration: track.duration,
          artists: sortedArtists.map((ta) => ({
            id: ta.artist.id,
            name: ta.artist.name,
          })),
          audioFile: track.audioFile
            ? {
                storageKey: track.audioFile.storageKey,
                format: track.audioFile.format,
                bitrate: track.audioFile.bitrate,
                sampleRate: track.audioFile.sampleRate,
                fileSize: track.audioFile.fileSize.toString(),
              }
            : null,
        };
      }),
    };
  }

  /**
   * Get all artists
   */
  async getArtists() {
    const artists = await this.prisma.artist.findMany({
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

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      albumCount: artist.albums.length,
      trackCount: artist.tracks.length,
    }));
  }

  /**
   * Get all albums by an artist
   */
  async getArtistAlbums(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
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

    if (!artist) {
      throw new NotFoundException(`Artist with ID ${artistId} not found`);
    }

    return {
      id: artist.id,
      name: artist.name,
      albums: artist.albums.map((album) => ({
        id: album.id,
        title: album.title,
        releaseYear: album.releaseYear,
        genre: album.genre,
        albumArtKey: album.albumArtKey,
        trackCount: album.tracks.length,
        totalDuration: album.tracks.reduce(
          (sum, track) => sum + (track.duration || 0),
          0,
        ),
      })),
    };
  }

  /**
   * Calculate SHA-256 checksum of a file buffer
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Extract metadata from audio file buffer
   */
  private async extractMetadata(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedMetadata> {
    const metadata = await mm.parseBuffer(buffer, { mimeType });

    const common = metadata.common;

    return {
      title: common.title || 'Unknown Title',
      album: common.album || 'Unknown Album',
      artists: this.parseArtists(common.artist, common.artists),
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      trackNumber: common.track?.no ?? null,
      discNumber: common.disk?.no ?? null,
      releaseYear: common.year ?? null,
      genre: common.genre?.[0] ?? null,
      duration: Math.floor(metadata.format.duration || 0),
      format: metadata.format.container || 'unknown',
      bitrate: metadata.format.bitrate ?? null,
      sampleRate: metadata.format.sampleRate ?? null,
      picture: common.picture?.[0],
    };
  }

  /**
   * Parse artist string into array, handling multiple artists
   */
  private parseArtists(artist?: string, artists?: string[]): string[] {
    if (artists && artists.length > 0) {
      return artists;
    }

    if (artist) {
      // Split on common separators
      const separators = [' & ', ' and ', ' feat. ', ' ft. ', ', '];
      let result = [artist];

      for (const sep of separators) {
        result = result.flatMap((a) => a.split(sep));
      }

      return result.map((a) => a.trim()).filter((a) => a.length > 0);
    }

    return ['Unknown Artist'];
  }

  /**
   * Upload album art to storage with deduplication
   */
  private async uploadAlbumArt(picture: mm.IPicture) {
    // Generate checksum for deduplication
    const imageBuffer = Buffer.from(picture.data);

    const artChecksum = createHash('sha256')
      .update(imageBuffer)
      .digest('hex')
      .substring(0, 16);

    const extension = picture.format.split('/')[1] || 'jpg';

    return await this.storage.uploadAlbumArt(
      artChecksum,
      extension,
      imageBuffer,
      picture.format,
    );
  }

  /**
   * Find potential duplicate based on metadata (same title, album, artists)
   */
  private async findMetadataDuplicate(metadata: {
    title: string;
    album: string;
    artists: string[];
  }) {
    const tracks = await this.prisma.track.findMany({
      where: {
        title: metadata.title,
        album: {
          title: metadata.album,
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

    for (const track of tracks) {
      const trackArtists = track.artists.map((ta) => ta.artist.name).sort();
      const newArtists = [...metadata.artists].sort();

      if (JSON.stringify(trackArtists) === JSON.stringify(newArtists)) {
        return track;
      }
    }

    return null;
  }

  /**
   * Create track and related records in database transaction
   */
  private async createTrackWithMetadata(
    metadata: ExtractedMetadata,
    audioKey: string,
    albumArtKey: string | undefined,
    checksum: string,
    fileSize: number,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create or find album artist (now that name is unique)
      const albumArtist = await tx.artist.upsert({
        where: { name: metadata.albumArtist },
        update: {},
        create: { name: metadata.albumArtist },
      });

      // 2. Create or find album
      const album = await tx.album.upsert({
        where: {
          title_artistId: {
            title: metadata.album,
            artistId: albumArtist.id,
          },
        },
        update: {
          genre: metadata.genre ?? undefined,
          albumArtKey: albumArtKey ?? undefined,
          releaseYear: metadata.releaseYear ?? undefined,
        },
        create: {
          title: metadata.album,
          artistId: albumArtist.id,
          releaseYear: metadata.releaseYear,
          genre: metadata.genre,
          albumArtKey,
        },
      });

      // 3. Create or find track artists (now that name is unique)
      const trackArtists = await Promise.all(
        metadata.artists.map((name: string) =>
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
          title: metadata.title,
          albumId: album.id,
          trackNumber: metadata.trackNumber,
          discNumber: metadata.discNumber,
          duration: metadata.duration,
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
          storageKey: audioKey,
          format: metadata.format,
          bitrate: metadata.bitrate,
          sampleRate: metadata.sampleRate,
          fileSize: BigInt(fileSize),
          checksum,
        },
      });

      return track;
    });
  }
}
