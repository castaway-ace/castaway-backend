import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import { type Response } from 'express';
import * as mm from 'music-metadata';
import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { MusicRepository } from './music.repository.js';
import {
  AlbumUploadResult,
  ExtractedMetadata,
  TrackFilter,
  TrackItemWithRelations,
  TrackWithRelations,
  UploadResult,
} from './music.types.js';
import { StorageUploadResult } from '../storage/storage.types.js';

@Injectable()
export class MusicService {
  private readonly TRACK_PREFIX = 'tracks/';
  private readonly ALBUM_ART_PREFIX = 'album-art/';
  private readonly logger = new Logger(MusicService.name);

  constructor(
    private storage: StorageService,
    private readonly musicRepository: MusicRepository,
  ) {}

  // ==================== UPLOAD ====================

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
   * Upload multiple tracks as an album
   */
  async uploadAlbum(files: Express.Multer.File[]): Promise<AlbumUploadResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results: string[] = [];
    const duplicates: string[] = [];
    const failures: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const result = await this.uploadTrack(file);
        results.push(result.trackId);
        if (result.duplicate) {
          duplicates.push(file.originalname);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        failures.push({
          filename: file.originalname,
          error: errorMessage,
        });
        this.logger.error(
          `Failed to upload ${file.originalname}: ${errorMessage}`,
        );
      }
    }

    return {
      trackIds: results,
      duplicates,
      failures,
      message: `Uploaded ${results.length} tracks. ${duplicates.length} duplicates detected. ${failures.length} failures.`,
    };
  }

  // ==================== TRACKS ====================

  /**
   * Get tracks with optional filtering
   */
  async getTracks(
    filter: TrackFilter,
  ): Promise<{ tracks: TrackItemWithRelations[]; total: number }> {
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

    const [tracks, total] = await Promise.all([
      this.musicRepository.findTracks(where, {
        take: filter.limit,
        skip: filter.offset,
      }),
      this.musicRepository.countTracks(where),
    ]);

    return { tracks, total };
  }

  /**
   * Get a single track by ID
   */
  async getTrack(id: string): Promise<TrackWithRelations> {
    const track = await this.musicRepository.findTrackById(id);

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    return track;
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

  async verifyTrackAccess(storageKey: string): Promise<void> {
    const audioFile =
      await this.musicRepository.findAudioFileByStorageKey(storageKey);

    if (!audioFile) {
      throw new NotFoundException('Track not found');
    }
  }

  // ==================== ARTISTS ====================

  async getArtists() {
    const artists = await this.musicRepository.findAllArtists();

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      albumCount: artist.albums.length,
      trackCount: artist.tracks.length,
    }));
  }

  async getAlbums() {
    const albums = await this.musicRepository.findAllAlbums();
    return albums.map((album) => ({
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

  // ==================== ALBUMS ====================

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
   * Get album art key
   */
  async getAlbumArtKey(albumId: string): Promise<string | undefined> {
    const album = await this.musicRepository.findAlbumById(albumId);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album.albumArtKey ?? undefined;
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(query: string, type: 'all' | 'track' | 'artist' | 'album') {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const results = await this.musicRepository.search(query, type);

    const response: {
      tracks?: unknown[];
      artists?: unknown[];
      albums?: unknown[];
    } = {};

    if ('tracks' in results && results.tracks) {
      response.tracks = results.tracks.map((track) =>
        this.formatTrackResponse(track),
      );
    }

    if ('artists' in results && results.artists) {
      response.artists = results.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        albumCount: artist.albums.length,
        trackCount: artist.tracks.length,
      }));
    }

    if ('albums' in results && results.albums) {
      response.albums = results.albums.map((album) => ({
        id: album.id,
        title: album.title,
        releaseYear: album.releaseYear,
        genre: album.genre,
        albumArtKey: album.albumArtKey,
        trackCount: album.tracks.length,
        artist: {
          id: album.artist.id,
          name: album.artist.name,
        },
      }));
    }

    return response;
  }

  // ==================== PRIVATE HELPERS ====================

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

  /**
   * Format track response with consistent structure
   */
  private formatTrackResponse(track: {
    id: string;
    title: string;
    trackNumber: number | null;
    discNumber: number | null;
    duration: number | null;
    artists: Array<{
      order: number;
      artist: {
        id: string;
        name: string;
      };
    }>;
    album: {
      id: string;
      title: string;
      releaseYear: number | null;
      genre: string | null;
      albumArtKey: string | null;
      artist: {
        id: string;
        name: string;
      };
    };
    audioFile?: {
      storageKey: string;
      format: string;
      bitrate: number | null;
      sampleRate: number | null;
      fileSize: bigint;
    } | null;
  }) {
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
