import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
} from '@nestjs/common';
import { type Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MusicService } from './music.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';
import { type AuthenticatedUser, CurrentUser } from '../user/user.decorator.js';

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

  // ==================== UPLOAD ====================

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
   * Upload multiple tracks as an album
   * POST /music/upload/album
   */
  @Post('upload/album')
  @UseInterceptors(FilesInterceptor('files', 30)) // Max 30 tracks per album
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
   * Stream a track
   * GET /music/tracks/:id/stream
   */
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

  /**
   * Get play statistics for a track
   * GET /music/tracks/:id/stats
   */
  @Get('tracks/:id/stats')
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
  async getArtists() {
    const artists = await this.musicService.getArtists();

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
  async getAlbumTracks(@Param('id') id: string) {
    const tracks = await this.musicService.getAlbumTracks(id);

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  @Get('albums/:id/art')
  async getAlbumArt(@Param('id') id: string, @Res() res: Response) {
    const albumArtKey = await this.musicService.getAlbumArtKey(id);

    if (!albumArtKey) {
      throw new NotFoundException('Album art not found');
    }

    await this.musicService.streamImage(albumArtKey, res);
  }

  // ==================== PLAYLISTS ====================

  /**
   * Get all playlists of a user
   * GET /music/artists
   */
  @Get('playlists')
  async getPlaylists(@CurrentUser() user: AuthenticatedUser) {
    const playlists = await this.musicService.getPlaylists(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: playlists,
    };
  }

  /**
   * Get a single playlist with tracks
   * GET /music/playlists/:id
   */
  @Get('playlists/:id')
  async getPlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const playlist = await this.musicService.getPlaylist(id, user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: playlist,
    };
  }

  /**
   * Create a new playlist
   * POST /music/playlists
   * Body: { name: string, description?: string, isPublic?: boolean }
   */
  @Post('playlists')
  async createPlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string; description?: string; isPublic?: boolean },
  ) {
    if (!body.name || body.name.trim().length === 0) {
      throw new BadRequestException('Playlist name is required');
    }

    const playlist = await this.musicService.createPlaylist(user.userId, {
      name: body.name,
      description: body.description,
      isPublic: body.isPublic,
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Playlist created successfully',
      data: playlist,
    };
  }

  /**
   * Update playlist metadata
   * PATCH /music/playlists/:id
   * Body: { name?: string, description?: string, isPublic?: boolean, coverImage?: string }
   */
  @Patch('playlists/:id')
  async updatePlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      coverImage?: string;
    },
  ) {
    const playlist = await this.musicService.updatePlaylist(
      id,
      user.userId,
      body,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Playlist updated successfully',
      data: playlist,
    };
  }

  /**
   * Delete a playlist
   * DELETE /music/playlists/:id
   */
  @Delete('playlists/:id')
  async deletePlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.musicService.deletePlaylist(id, user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Add tracks to playlist
   * POST /music/playlists/:id/tracks
   * Body: { trackIds: string[] }
   */
  @Post('playlists/:id/tracks')
  async addTracksToPlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[] },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.musicService.addTracksToPlaylist(
      id,
      user.userId,
      body.trackIds,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Remove track from playlist
   * DELETE /music/playlists/:id/tracks/:trackId
   */
  @Delete('playlists/:id/tracks/:trackId')
  async removeTrackFromPlaylist(
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.musicService.removeTrackFromPlaylist(
      id,
      trackId,
      user.userId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Reorder tracks in playlist
   * PUT /music/playlists/:id/tracks/reorder
   * Body: { updates: Array<{ id: string, position: number }> }
   */
  @Patch('playlists/:id/tracks/reorder')
  async reorderPlaylistTracks(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { updates: Array<{ id: string; position: number }> },
  ) {
    if (!body.updates || body.updates.length === 0) {
      throw new BadRequestException('Updates are required');
    }

    const result = await this.musicService.reorderPlaylistTracks(
      id,
      user.userId,
      body.updates,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  // ==================== USER LIBRARY ====================

  /**
   * Add track to library
   * POST /music/library/tracks/:id
   */
  @Post('library/tracks/:id')
  async addToLibrary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.musicService.addToLibrary(user.userId, id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Remove track from library
   * DELETE /music/library/tracks/:id
   */
  @Delete('library/tracks/:id')
  async removeFromLibrary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.musicService.removeFromLibrary(user.userId, id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Get all tracks in library
   * GET /music/library/tracks?limit=50&offset=0
   */
  @Get('library/tracks')
  async getLibraryTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tracks = await this.musicService.getLibraryTracks(user.userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  /**
   * Get distinct artists from library
   * GET /music/library/artists
   */
  @Get('library/artists')
  async getLibraryArtists(@CurrentUser() user: AuthenticatedUser) {
    const artists = await this.musicService.getLibraryArtists(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: artists,
    };
  }

  /**
   * Get distinct albums from library
   * GET /music/library/albums
   */
  @Get('library/albums')
  async getLibraryAlbums(@CurrentUser() user: AuthenticatedUser) {
    const albums = await this.musicService.getLibraryAlbums(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: albums,
    };
  }

  // ==================== LISTENING HISTORY ====================

  /**
   * Record a track play
   * POST /music/history
   * Body: { trackId: string, duration?: number }
   */
  @Post('history')
  async recordPlay(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackId: string; duration?: number },
  ) {
    if (!body.trackId) {
      throw new BadRequestException('Track ID is required');
    }

    const result = await this.musicService.recordPlay(
      user.userId,
      body.trackId,
      body.duration,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Get recent plays
   * GET /music/history/recent?limit=50
   */
  @Get('history/recent')
  async getRecentPlays(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const history = await this.musicService.getRecentPlays(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      statusCode: HttpStatus.OK,
      data: history,
    };
  }

  // ==================== QUEUE ====================

  /**
   * Get current queue
   * GET /music/queue
   */
  @Get('queue')
  async getQueue(@CurrentUser() user: AuthenticatedUser) {
    const queue = await this.musicService.getQueue(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: queue,
    };
  }

  /**
   * Set queue from source
   * POST /music/queue
   * Body: { trackIds: string[], currentTrackId?: string }
   */
  @Post('queue')
  async setQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[]; currentTrackId?: string },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.musicService.setQueue(
      user.userId,
      body.trackIds,
      body.currentTrackId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Update queue state
   * PATCH /music/queue
   * Body: { currentTrackId?: string, position?: number, shuffleEnabled?: boolean, repeatMode?: string }
   */
  @Patch('queue')
  async updateQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      currentTrackId?: string;
      position?: number;
      shuffleEnabled?: boolean;
      repeatMode?: 'OFF' | 'ONE' | 'ALL';
    },
  ) {
    const result = await this.musicService.updateQueue(user.userId, body);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Add tracks to queue
   * POST /music/queue/tracks
   * Body: { trackIds: string[] }
   */
  @Post('queue/tracks')
  async addToQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[] },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.musicService.addToQueue(
      user.userId,
      body.trackIds,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Remove item from queue
   * DELETE /music/queue/items/:id
   */
  @Delete('queue/items/:id')
  async removeFromQueue(@Param('id') id: string) {
    const result = await this.musicService.removeFromQueue(id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Reorder queue items
   * PATCH /music/queue/reorder
   * Body: { updates: Array<{ id: string, position: number }> }
   */
  @Patch('queue/reorder')
  async reorderQueue(
    @Body() body: { updates: Array<{ id: string; position: number }> },
  ) {
    if (!body.updates || body.updates.length === 0) {
      throw new BadRequestException('Updates are required');
    }

    const result = await this.musicService.reorderQueue(body.updates);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   * GET /music/search?q=query&type=all|track|artist|album
   */
  @Get('search')
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
