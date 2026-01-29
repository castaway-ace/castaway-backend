import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  StorageService,
  StorageUploadResult,
} from '../storage/storage.service.js';
import { type Response } from 'express';
import * as mm from 'music-metadata';
import { createHash } from 'crypto';
import { Prisma } from 'src/generated/prisma/client.js';
import { MusicRepository } from './music.repository.js';

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
  private readonly TRACK_PREFIX = 'tracks/';
  private readonly ALBUM_ART_PREFIX = 'album-art/';
  private readonly logger = new Logger(MusicService.name);

  constructor(
    private storage: StorageService,
    private readonly musicRepository: MusicRepository,
  ) {}

  /**
   * Upload a track with automatic metadata extraction and storage
   */
  async uploadTrack(file: Express.Multer.File): Promise<UploadResult> {
    // Step 1: Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    const existingFile =
      await this.musicRepository.findAudioFileByChecksum(checksum);

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

    const storageKey = `${this.TRACK_PREFIX}${checksum}.${metadata.format}`;

    // Step 5: Upload audio file to MinIO
    const audioUpload: StorageUploadResult = await this.storage.uploadFile(
      storageKey,
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
    const track = await this.musicRepository.createTrackWithRelations({
      metadata: {
        title: metadata.title,
        album: metadata.album,
        albumArtist: metadata.albumArtist,
        artists: metadata.artists,
        trackNumber: metadata.trackNumber,
        discNumber: metadata.discNumber,
        releaseYear: metadata.releaseYear,
        genre: metadata.genre,
        duration: metadata.duration,
        format: metadata.format,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
      },
      audioKey: audioUpload.storageKey,
      albumArtKey,
      checksum,
      fileSize: audioUpload.size,
    });

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

    const tracks = await this.musicRepository.findTracks(where, {
      take: filter.limit,
      skip: filter.offset,
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
    const track = await this.musicRepository.findTrackById(id);

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

  async getArtists() {
    const artists = await this.musicRepository.findAllArtists();

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
    const artist = await this.musicRepository.findArtistById(artistId);

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
   * Get all tracks in an album
   */
  async getAlbumTracks(albumId: string) {
    const album = await this.musicRepository.findAlbumWithTracks(albumId);

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
   * Stream a track (audio file)
   */
  async streamTrack(
    storageKey: string,
    range: string | undefined,
    res: Response,
  ): Promise<void> {
    try {
      const stats = await this.storage.getFileStats(storageKey);

      const contentType = this.getContentType(stats.metaData, 'audio/mpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunkSize = end - start + 1;

        if (start >= stats.size || end >= stats.size) {
          res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
          res.setHeader('Content-Range', `bytes */${stats.size}`);
          res.end();
          return;
        }

        res.status(HttpStatus.PARTIAL_CONTENT);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', chunkSize);

        this.logger.log(
          `Streaming ${storageKey} [${start}-${end}/${stats.size}]`,
        );

        const fileStream = await this.storage.getFileRange(
          storageKey,
          start,
          chunkSize,
        );

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      } else {
        res.setHeader('Content-Length', stats.size);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${storageKey}"`,
        );

        this.logger.log(
          `Streaming ${storageKey} [full file: ${stats.size} bytes]`,
        );

        const fileStream = await this.storage.getFile(storageKey);

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      }
    } catch (error) {
      this.handleStreamError(error, res);
    }
  }

  /**
   * Stream an image (album art)
   */
  async streamImage(storageKey: string, res: Response): Promise<void> {
    try {
      const stats = await this.storage.getFileStats(storageKey);

      const contentType = this.getContentType(stats.metaData, 'image/jpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      this.logger.log(`Streaming image: ${storageKey}`);

      const fileStream = await this.storage.getFile(storageKey);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        this.logger.error(
          `Stream error for image ${storageKey}: ${error.message}`,
        );
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: 'Stream error',
          });
        }
      });
    } catch (error) {
      this.handleStreamError(error, res);
    }
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

  async getAlbumArtKey(albumId: string): Promise<string | null> {
    const album = await this.musicRepository.findAlbumById(albumId, {
      select: { id: true, albumArtKey: true },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album.albumArtKey;
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
    const imageBuffer = Buffer.from(picture.data);

    const artChecksum = createHash('sha256')
      .update(imageBuffer)
      .digest('hex')
      .substring(0, 16);

    const extension = picture.format.split('/')[1] || 'jpg';

    const storageKey = `${this.ALBUM_ART_PREFIX}${artChecksum}.${extension}`;

    return await this.storage.uploadFile(
      storageKey,
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
    const tracks = await this.musicRepository.findTracksByMetadata(
      metadata.title,
      metadata.album,
    );

    for (const track of tracks) {
      const trackArtists = track.artists.map((ta) => ta.artist.name).sort();
      const newArtists = [...metadata.artists].sort();

      if (JSON.stringify(trackArtists) === JSON.stringify(newArtists)) {
        return track;
      }
    }

    return null;
  }

  private getContentType(
    metaData: Record<string, any>,
    defaultType: string,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const contentType = metaData['content-type'];
    if (typeof contentType === 'string') {
      return contentType;
    }
    return defaultType;
  }

  private handleStreamError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Streaming failed: ${errorMessage}`);

    if (!res.headersSent) {
      if (error instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND).json({
          message: 'File not found',
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Streaming failed',
          error: errorMessage,
        });
      }
    }
  }
}
