import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../user/user.decorator.js';
import { PlaylistService } from './playlist.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';

@Controller('playlist')
@UseGuards(JwtAuthGuard)
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  /**
   * Get all playlists of a user
   * GET /playlists
   */
  @Get('/')
  async getPlaylists(@CurrentUser() user: AuthenticatedUser) {
    const playlists = await this.playlistService.getPlaylists(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: playlists,
    };
  }

  /**
   * Get a single playlist with tracks
   * GET /playlists/:id
   */
  @Get('/:id')
  async getPlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const playlist = await this.playlistService.getPlaylist(id, user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: playlist,
    };
  }

  /**
   * Create a new playlist
   * POST /playlists
   * Body: { name: string, description?: string, isPublic?: boolean }
   */
  @Post('/')
  async createPlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string; description?: string; isPublic?: boolean },
  ) {
    if (!body.name || body.name.trim().length === 0) {
      throw new BadRequestException('Playlist name is required');
    }

    const playlist = await this.playlistService.createPlaylist(user.userId, {
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
   * PATCH /playlists/:id
   * Body: { name?: string, description?: string, isPublic?: boolean, coverImage?: string }
   */
  @Patch('/:id')
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
    const playlist = await this.playlistService.updatePlaylist(
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
   * DELETE /playlists/:id
   */
  @Delete('/:id')
  async deletePlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.playlistService.deletePlaylist(id, user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Add tracks to playlist
   * POST /playlists/:id/tracks
   * Body: { trackIds: string[] }
   */
  @Post('/:id/tracks')
  async addTracksToPlaylist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[] },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.playlistService.addTracksToPlaylist(
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
   * DELETE /playlists/:id/tracks/:trackId
   */
  @Delete('/:id/tracks/:trackId')
  async removeTrackFromPlaylist(
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.playlistService.removeTrackFromPlaylist(
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
   * PUT /playlists/:id/tracks/reorder
   * Body: { updates: Array<{ id: string, position: number }> }
   */
  @Patch('/:id/tracks/reorder')
  async reorderPlaylistTracks(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { updates: Array<{ id: string; position: number }> },
  ) {
    if (!body.updates || body.updates.length === 0) {
      throw new BadRequestException('Updates are required');
    }

    const result = await this.playlistService.reorderPlaylistTracks(
      id,
      user.userId,
      body.updates,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }
}
