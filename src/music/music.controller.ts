import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Headers,
  Res,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
  Patch,
  Body,
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service.js';
import { Roles, RolesGuard } from 'src/auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { OptionalAuthGuard } from 'src/auth/guards/optional-oauth.guard.js';
import { JwtAuthGuard } from 'src/auth/guards/jwt-oauth.guard.js';
import { type RequestWithUser } from 'src/auth/auth.types.js';

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

  constructor(private readonly musicService: MusicService) {}

  // ==================== UPLOAD ====================

  /**
   * Upload a track with automatic metadata extraction
   * POST /music/upload
   */
  @Post('upload')
  @UseGuards(RolesGuard)
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
    @Query('artist') artist?: string,
    @Query('album') album?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Req() req?: RequestWithUser,
  ) {
    const userId = req?.user?.id;
    const tracks = await this.musicService.getTracks(
      {
        artist,
        album,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      },
      userId,
    );

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  /**
   * Get a single track by ID
   * GET /music/tracks/:id
   */
  @Get('tracks/:id')
  @UseGuards(OptionalAuthGuard)
  async getTrack(@Param('id') id: string, @Req() req?: RequestWithUser) {
    const userId = req?.user?.id;
    const track = await this.musicService.getTrack(id, userId);

    return {
      statusCode: HttpStatus.OK,
      data: track,
    };
  }

  /**
   * Stream a track
   * GET /music/tracks/:id/stream
   */
  @Get('tracks/:id/stream')
  @UseGuards(OptionalAuthGuard)
  async streamTrack(
    @Param('id') id: string,
    @Headers('range') range: string,
    @Res() res: Response,
    @Req() req?: RequestWithUser,
  ) {
    const userId = req?.user?.id;
    const track = await this.musicService.getTrack(id, userId);

    if (!track.audioFile) {
      throw new NotFoundException('Audio file not found for this track');
    }

    await this.musicService.verifyTrackAccess(
      track.audioFile.storageKey,
      userId,
    );

    await this.musicService.streamTrack(track.audioFile.storageKey, range, res);
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

  /**
   * Toggle track public visibility (admin only)
   * PATCH /music/tracks/:id/visibility
   */
  @Patch('tracks/:id/visibility')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleTrackVisibility(
    @Param('id') id: string,
    @Body('isPublic') isPublic: boolean,
  ) {
    const track = await this.musicService.updateTrackVisibility(id, isPublic);

    return {
      statusCode: HttpStatus.OK,
      message: `Track visibility updated to ${isPublic ? 'public' : 'private'}`,
      data: {
        trackId: track.id,
        isPublic: track.isPublic as boolean,
      },
    };
  }

  // ==================== ARTISTS ====================

  /**
   * Get all artists
   * GET /music/artists
   */
  @Get('artists')
  @UseGuards(OptionalAuthGuard)
  async getArtists(@Req() req?: RequestWithUser) {
    const userId = req?.user?.id;
    const artists = await this.musicService.getArtists(userId);

    return {
      statusCode: HttpStatus.OK,
      data: artists,
    };
  }

  /**
   * Get all albums by an artist
   * GET /music/albums
   */
  @Get('albums/:id')
  @UseGuards(OptionalAuthGuard)
  async getArtistAlbums(@Param('id') id: string, @Req() req?: RequestWithUser) {
    const userId = req?.user?.id;
    const albums = await this.musicService.getArtistAlbums(id, userId);

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
  async getAlbumTracks(@Param('id') id: string, @Req() req?: RequestWithUser) {
    const userId = req?.user?.id;
    const tracks = await this.musicService.getAlbumTracks(id, userId);

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  @Get('albums/:id/art')
  @UseGuards(OptionalAuthGuard)
  async getAlbumArt(@Param('id') id: string, @Res() res: Response) {
    const albumArtKey = await this.musicService.getAlbumArtKey(id);

    if (!albumArtKey) {
      throw new NotFoundException('Album art not found');
    }

    await this.musicService.streamImage(albumArtKey, res);
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
    @Req() req?: RequestWithUser,
  ) {
    const userId = req?.user?.id;

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const results = await this.musicService.search(
      query,
      type || 'all',
      userId,
    );

    return {
      statusCode: HttpStatus.OK,
      data: results,
    };
  }
}
