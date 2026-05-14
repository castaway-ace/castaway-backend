import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { PlaylistsService } from './playlists.service.js';
import { Playlist, PlaylistTrack } from '../../generated/prisma/client.js';
import { PlaylistCreateDto as PlaylistDto } from '../dto/playlist.dto.js';
import { PlaylistTrackDto } from '../dto/playlist-track.dto.js';

@Controller('playlists')
@UseGuards(AuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Post('')
  async createPlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.createPlaylist(playlistDto.name, user.sub);
  }

  @Get('')
  async getPlaylists(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Playlist[]> {
    return await this.playlistService.findPlaylists(user.sub);
  }

  @Get('/:id')
  async getPlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Playlist> {
    const playlist = await this.playlistService.findPlaylist(id);

    if (!playlist || (!playlist.public && playlist.ownerId !== user.sub)) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }

  @Patch('/:id')
  async updatePlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.updatePlaylist(id, user.sub, playlistDto.name);
  }

  @Delete('/:id')
  async deletePlaylist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.playlistService.deletePlaylist(id, user.sub);
  }

  @Post('/:id/tracks')
  async addPlaylistTrack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() playlistTrackDto: PlaylistTrackDto,
  ): Promise<void> {
    await this.playlistService.addPlaylistTrack(
      id,
      user.sub,
      playlistTrackDto.id,
    );
  }

  @Get('/:id/tracks')
  async getPlaylistTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PlaylistTrack[]> {
    return await this.playlistService.getPlaylistTracks(id, user.sub);
  }

  @Get('/:id/tracks/:trackId')
  async getPlaylistTrack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<PlaylistTrack | null> {
    const playlistTrack = await this.playlistService.getPlaylistTrack(
      id,
      user.sub,
      trackId,
    );

    if (!playlistTrack) {
      throw new NotFoundException('Playlist tracks not found');
    }
    return playlistTrack;
  }

  @Delete('/:id/tracks/:trackId')
  async deletePlaylistTrack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.deletePlaylistTrack(id, user.sub, trackId);
  }
}
