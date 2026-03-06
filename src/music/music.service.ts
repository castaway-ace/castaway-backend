import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import * as mm from 'music-metadata';
import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { MusicRepository } from './music.repository.js';
import {
  AlbumListItem,
  AlbumUploadResult,
  ArtistWithCounts,
  ExtractedMetadata,
  SearchResults,
  StreamDescriptor,
  TrackFilter,
  TrackItemWithRelations,
  TrackStats,
  TrackWithRelations,
  UploadResult,
} from './music.types.js';
import { StorageUploadResult } from '../storage/storage.types.js';
import { PaginationFilter } from 'src/types/pagination.types.js';
import { ArtistAlbumsDto } from './dto/artist.dto.js';
import { AlbumDetailDto } from './dto/album.dto.js';

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
    const checksum = this.calculateChecksum(file.buffer);

    const existingFile =
      await this.musicRepository.findAudioFileByChecksum(checksum);

    if (existingFile) {
      throw new ConflictException(
        `This exact file already exists as track: ${existingFile.track.title}`,
      );
    }

    const metadata = await this.extractMetadata(file.buffer, file.mimetype);

    const potentialDuplicate = await this.findMetadataDuplicate(metadata);

    if (potentialDuplicate) {
      this.logger.warn(
        `Potential duplicate found: ${metadata.title} by ${metadata.artists.join(', ')}`,
      );
    }

    const storageKey = `${this.TRACK_PREFIX}${checksum}.${file.mimetype}`;

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

    let albumArtKey: string | undefined;
    if (metadata.picture) {
      const artUpload = await this.uploadAlbumArt(metadata.picture);
      albumArtKey = artUpload.storageKey;
    }

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
        mimeType: metadata.mimeType,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
      },
      audioKey: audioUpload.storageKey,
      albumArtKey,
      checksum,
      size: audioUpload.size,
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
  async getTrackById(id: string): Promise<TrackWithRelations> {
    const track = await this.musicRepository.findTrackById(id);

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    return track;
  }

  /**
   * Get a track stream
   */
  async getTrackStream(
    id: string,
    rangeHeader?: string,
  ): Promise<StreamDescriptor> {
    const track = await this.getTrackById(id);

    if (!track.audioFile) {
      throw new NotFoundException('Audio file not found for this track');
    }

    const { storageKey, mimeType } = track.audioFile;
    const size = Number(track.audioFile.size);

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        throw new BadRequestException('Invalid range header');
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      const length = end - start + 1;

      const stream = await this.storage.getFileRange(storageKey, start, length);

      return {
        stream,
        mimeType,
        size,
        range: { start, end, length },
      };
    }

    const stream = await this.storage.getFile(storageKey);

    return { stream, mimeType, size };
  }

  /**
   * Get play statistics for a track
   */
  async getTrackStats(trackId: string): Promise<TrackStats> {
    return await this.musicRepository.getTrackStats(trackId);
  }

  // ==================== ARTISTS ====================

  async getArtists(
    filter: PaginationFilter,
  ): Promise<{ artists: ArtistWithCounts[]; total: number }> {
    const where: Prisma.ArtistWhereInput = {};

    const [artists, total] = await Promise.all([
      this.musicRepository.findArtists(where, {
        take: filter.limit,
        skip: filter.offset,
      }),
      this.musicRepository.countArtists(where),
    ]);

    return { artists, total };
  }

  /**
   * Get an artist by ID
   */
  async getArtistById(artistId: string): Promise<ArtistAlbumsDto> {
    const artist = await this.musicRepository.findArtistById(artistId);

    if (!artist) {
      throw new NotFoundException(`Artist with ID ${artistId} not found`);
    }

    return ArtistAlbumsDto.from(artist);
  }

  // ==================== ALBUMS ====================

  async getAlbums(
    filter: PaginationFilter,
  ): Promise<{ albums: AlbumListItem[]; total: number }> {
    const [albums, total] = await Promise.all([
      this.musicRepository.findAllAlbums({
        take: filter.limit,
        skip: filter.offset,
      }),
      this.musicRepository.countAlbums(),
    ]);

    return { albums, total };
  }

  /**
   * Get an album by ID
   */
  async getAlbum(albumId: string): Promise<AlbumDetailDto> {
    const album = await this.musicRepository.findAlbumById(albumId);

    if (!album) {
      throw new NotFoundException(`Album with ID ${albumId} not found`);
    }

    return AlbumDetailDto.from(album);
  }

  /**
   * Get album art stream
   */
  async getAlbumArtStream(albumId: string): Promise<StreamDescriptor> {
    const album = await this.musicRepository.findAlbumArt(albumId);

    if (!album || !album.albumArtKey) {
      throw new NotFoundException('Album art not found');
    }

    const stats = await this.storage.getFileStats(album.albumArtKey);
    const stream = await this.storage.getFile(album.albumArtKey);

    const extension = album.albumArtKey.split('.').pop() ?? 'jpg';
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

    return { stream, mimeType, size: stats.size };
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(
    query: string,
    type: 'all' | 'track' | 'artist' | 'album',
  ): Promise<SearchResults> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    return this.musicRepository.search(query, type);
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
      mimeType: mimeType,
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
  private async uploadAlbumArt(
    picture: mm.IPicture,
  ): Promise<StorageUploadResult> {
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
}
