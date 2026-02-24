import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service.js';
import { Roles, RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { OptionalAuthGuard } from '../auth/guards/optional-oauth.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';
import { TrackFilter } from './music.types.js';
import { StorageService } from '../storage/storage.service.js';
import { TrackListResponseDto } from './dto/track-list-response.dto.js';
import { toTrackItemDto } from './dto/track-item.mapper.js';
import { type Response } from 'express';
import { TrackDetailDto } from './dto/track-detail.dto.js';
import { toTrackDetailDto } from './dto/track-detail.mapper.js';

@Controller('music')
export class MusicController {
  private readonly logger = new Logger(MusicController.name);

  private readonly ALLOWED_MIME_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/flac',
    'audio/x-flac',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a',
  ];

  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  constructor(
    private readonly musicService: MusicService,
    private readonly storageService: StorageService,
  ) {}

  // ==================== UPLOAD ====================

  /**
   * Upload a track with automatic metadata extraction
   * POST /music/upload
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrack(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    try {
      const result = await this.musicService.uploadTrack(file);

      return {
        statusCode: HttpStatus.OK,
        message: result.message,
        data: {
          trackId: result.trackId,
          duplicate: result.duplicate,
        },
      };
    } catch (error) {
      this.logger.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Upload multiple tracks as an album
   * POST /music/upload/album
   */
  @Post('upload/album')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 30))
  async uploadAlbum(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate all files
    for (const file of files) {
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname}. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
        );
      }

      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File ${file.originalname} too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }
    }

    try {
      const result = await this.musicService.uploadAlbum(files);

      return {
        statusCode: HttpStatus.OK,
        message: result.message,
        data: {
          trackIds: result.trackIds,
          duplicates: result.duplicates,
          failures: result.failures,
        },
      };
    } catch (error) {
      this.logger.error(
        `Album upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  // ==================== TRACKS ====================

  /**
   * Get all tracks with optional filtering
   * GET /music/tracks?artist=Beatles&album=Abbey%20Road
   */
  @Get('tracks')
  @UseGuards(OptionalAuthGuard)
  async getTracks(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('artist') artist?: string,
    @Query('album') album?: string,
  ): Promise<TrackListResponseDto> {
    const filter: TrackFilter = {
      limit,
      offset: (page - 1) * limit,
      artist,
      album,
    };

    const { tracks, total } = await this.musicService.getTracks(filter);

    return {
      data: tracks.map(toTrackItemDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single track by ID
   * GET /music/tracks/:id
   */
  @Get('tracks/:id')
  @UseGuards(OptionalAuthGuard)
  async getTrack(@Param('id') id: string): Promise<TrackDetailDto> {
    const track = await this.musicService.getTrackWithAccessCheck(id);

    return toTrackDetailDto(track);
  }

  /**
   * Stream a track
   * GET /music/tracks/:id/stream
   */
  @Get('tracks/:id/stream')
  @UseGuards(OptionalAuthGuard)
  async streamTrack(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const track = await this.musicService.getTrackWithAccessCheck(id);

    if (!track.audioFile) {
      res.status(404).json({ message: 'Audio file not found' });
      return;
    }

    const url = await this.storageService.getPresignedUrl(
      track.audioFile.storageKey,
      3600,
    );

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.redirect(url);
  }

  /**
   * Get play statistics for a track
   * GET /music/tracks/:id/stats
   */
  @Get('tracks/:id/stats')
  @UseGuards(JwtAuthGuard)
  async getTrackStats(@Param('id') id: string) {
    const stats = await this.musicService.getTrackStats(id);

    return {
      statusCode: HttpStatus.OK,
      data: stats,
    };
  }

  // ==================== ARTISTS ====================

  /**
   * Get all artists
   * GET /music/artists
   */
  @Get('artists')
  @UseGuards(OptionalAuthGuard)
  async getArtists() {
    const artists = await this.musicService.getArtists();

    return {
      statusCode: HttpStatus.OK,
      data: artists,
    };
  }

  /**
   * Get all albums
   * GET /music/albums
   */
  @Get('albums')
  @UseGuards(OptionalAuthGuard)
  async getAlbums() {
    const albums = await this.musicService.getAlbums();

    return {
      statusCode: HttpStatus.OK,
      data: albums,
    };
  }

  /**
   * Get all albums by an artist
   * GET /music/albums/:id
   */
  @Get('albums/:id')
  @UseGuards(OptionalAuthGuard)
  async getArtistAlbums(@Param('id') id: string) {
    const albums = await this.musicService.getArtistAlbums(id);

    return {
      statusCode: HttpStatus.OK,
      data: albums,
    };
  }

  // ==================== ALBUMS ====================

  /**
   * Get all tracks in an album
   * GET /music/albums/:id/tracks
   */
  @Get('albums/:id/tracks')
  @UseGuards(OptionalAuthGuard)
  async getAlbumTracks(@Param('id') id: string) {
    const tracks = await this.musicService.getAlbumTracks(id);

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  @Get('albums/:id/cover')
  @UseGuards(OptionalAuthGuard)
  async getAlbumCover(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const albumArtKey = await this.musicService.getAlbumArtKey(id);

    if (!albumArtKey) {
      throw new NotFoundException('Album art not found');
    }

    const url = await this.storageService.getPresignedUrl(
      albumArtKey,
      86400, // 24 hours
    );

    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.redirect(url);
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   * GET /music/search?q=query&type=all|track|artist|album
   */
  @Get('search')
  @UseGuards(OptionalAuthGuard)
  async search(
    @Query('q') query: string,
    @Query('type') type?: 'all' | 'track' | 'artist' | 'album',
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const results = await this.musicService.search(query, type || 'all');

    return {
      statusCode: HttpStatus.OK,
      data: results,
    };
  }
}
