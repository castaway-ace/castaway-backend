import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Headers,
  Res,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';

@Controller('music')
@UseGuards(JwtAuthGuard)
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

  /**
   * Upload a track with automatic metadata extraction
   * POST /music/upload
   */
  @Post('upload')
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
   * Get all tracks with optional filtering
   * GET /music/tracks?artist=Beatles&album=Abbey%20Road
   */
  @Get('tracks')
  async getTracks(
    @Query('artist') artist?: string,
    @Query('album') album?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tracks = await this.musicService.getTracks({
      artist,
      album,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

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
  async getTrack(@Param('id') id: string) {
    const track = await this.musicService.getTrack(id);

    return {
      statusCode: HttpStatus.OK,
      data: track,
    };
  }

  /**
   * Get all albums by an artist
   * GET /music/albums
   */
  @Get('albums/:id')
  async getArtistAlbums(@Param('id') id: string) {
    const albums = await this.musicService.getArtistAlbums(id);

    return {
      statusCode: HttpStatus.OK,
      data: albums,
    };
  }

  /**
   * Get all tracks in an album
   * GET /music/albums/:id/tracks
   */
  @Get('albums/:id/tracks')
  async getAlbumTracks(@Param('id') id: string) {
    const tracks = await this.musicService.getAlbumTracks(id);

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  /**
   * Get all artists
   * GET /music/artists
   */
  @Get('artists')
  async getArtists() {
    const artists = await this.musicService.getArtists();

    return {
      statusCode: HttpStatus.OK,
      data: artists,
    };
  }

  @Get('tracks/:id/stream')
  async streamTrack(
    @Param('id') id: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const track = await this.musicService.getTrack(id);

    if (!track.audioFile) {
      throw new NotFoundException('Audio file not found for this track');
    }

    await this.musicService.streamTrack(track.audioFile.storageKey, range, res);
  }

  @Get('albums/:id/art')
  async getAlbumArt(@Param('id') id: string, @Res() res: Response) {
    const albumArtKey = await this.musicService.getAlbumArtKey(id);

    if (!albumArtKey) {
      throw new NotFoundException('Album art not found');
    }

    await this.musicService.streamImage(albumArtKey, res);
  }
}
