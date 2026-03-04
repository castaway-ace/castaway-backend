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
  Res,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';
import {
  AlbumUploadResult,
  TrackFilter,
  TrackStats,
  UploadResult,
} from './music.types.js';
import { type Request, type Response } from 'express';
import { PaginationFilter } from 'src/types/pagination.types.js';
import {
  ArtistAlbumsDto,
  ArtistItemDto,
  ArtistListResponseDto,
} from './dto/artist.dto.js';
import {
  TrackListResponseDto,
  TrackDetailDto,
  TrackItemDto,
} from './dto/track.dto.js';
import {
  AlbumDetailDto,
  AlbumItemDto,
  AlbumListResponseDto,
} from './dto/album.dto.js';
import { SearchResponseDto } from './dto/search.dto.js';

@Controller('music')
export class MusicController {
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrack(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    this.validateFile(file);
    return await this.musicService.uploadTrack(file);
  }

  /**
   * Upload multiple tracks as an album
   * POST /music/upload/album
   */
  @Post('upload/album')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 30))
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<AlbumUploadResult> {
    for (const file of files) {
      this.validateFile(file);
    }
    return await this.musicService.uploadAlbum(files);
  }

  // ==================== TRACKS ====================

  /**
   * Get all tracks with optional filtering
   * GET /music/tracks?artist=Beatles&album=Abbey%20Road
   */
  @Get('tracks')
  @UseGuards(JwtAuthGuard)
  async getTracks(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
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
      data: tracks.map((track) => TrackItemDto.from(track)),
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
  @UseGuards(JwtAuthGuard)
  async getTrack(@Param('id') id: string): Promise<TrackDetailDto> {
    const track = await this.musicService.getTrackById(id);

    return TrackDetailDto.from(track);
  }

  /**
   * Stream a track
   * GET /music/tracks/:id/stream
   */
  @Get('tracks/:id/stream')
  @UseGuards(JwtAuthGuard)
  async streamTrack(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const descriptor = await this.musicService.getTrackStream(
      id,
      req.headers.range,
    );

    if (descriptor.range) {
      const { start, end, length } = descriptor.range;

      res.status(206);
      res.setHeader('Content-Type', descriptor.mimeType);
      res.setHeader('Content-Length', length);
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${descriptor.size}`,
      );
    } else {
      res.setHeader('Content-Type', descriptor.mimeType);
      res.setHeader('Content-Length', descriptor.size);
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    descriptor.stream.pipe(res);
  }

  /**
   * Get play statistics for a track
   * GET /music/tracks/:id/stats
   */
  @Get('tracks/:id/stats')
  @UseGuards(JwtAuthGuard)
  async getTrackStats(@Param('id') id: string): Promise<{ data: TrackStats }> {
    const stats = await this.musicService.getTrackStats(id);

    return { data: stats };
  }

  // ==================== ARTISTS ====================

  /**
   * Get all artists
   * GET /music/artists
   */
  @Get('artists')
  @UseGuards(JwtAuthGuard)
  async getArtists(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ArtistListResponseDto> {
    const filter: PaginationFilter = {
      limit,
      offset: (page - 1) * limit,
    };

    const { artists, total } = await this.musicService.getArtists(filter);

    return {
      data: artists.map((artist) => ArtistItemDto.from(artist)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all albums for an artist
   * GET /music/artists/:id/albums
   */
  @Get('artists/:id/albums')
  @UseGuards(JwtAuthGuard)
  async getArtistAlbums(@Param('id') id: string): Promise<ArtistAlbumsDto> {
    return await this.musicService.getArtistAlbums(id);
  }

  // ==================== ALBUMS ====================

  /**
   * Get all albums
   * GET /music/albums
   */
  @Get('albums')
  @UseGuards(JwtAuthGuard)
  async getAlbums(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<AlbumListResponseDto> {
    const filter: PaginationFilter = {
      limit,
      offset: (page - 1) * limit,
    };

    const { albums, total } = await this.musicService.getAlbums(filter);

    return {
      data: albums.map((album) => AlbumItemDto.from(album)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all tracks in an album
   * GET /music/albums/:id/tracks
   */
  @Get('albums/:id/tracks')
  @UseGuards(JwtAuthGuard)
  async getAlbumTracks(@Param('id') id: string): Promise<AlbumDetailDto> {
    return await this.musicService.getAlbumTracks(id);
  }

  /**
   * Get the album cover for an album
   * GET /music/albums/:id/cover
   */
  @Get('albums/:id/cover')
  @UseGuards(JwtAuthGuard)
  async getAlbumCover(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, size, mimeType } =
      await this.musicService.getAlbumArtStream(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'private, max-age=86400');

    stream.pipe(res);
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   * GET /music/search?q=query&type=all|track|artist|album
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Query('q') query: string,
    @Query('type') type?: 'all' | 'track' | 'artist' | 'album',
  ): Promise<SearchResponseDto> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const results = await this.musicService.search(query, type || 'all');

    return SearchResponseDto.from(results);
  }

  // ==================== PRIVATE HELPERS ====================

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }
}
