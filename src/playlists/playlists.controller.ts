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
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { PlaylistsService } from './playlists.service.js';
import { Playlist, PlaylistTrack } from '../../generated/prisma/client.js';
import { PlaylistDto } from '../dto/playlist.dto.js';

@Controller('playlists')
@UseGuards(AuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Post('')
  async createPlaylist(
    @CurrentUser('sub') sub: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.createPlaylist(playlistDto.name, sub);
  }

  @Get('')
  async getPlaylists(@CurrentUser('sub') sub: string): Promise<Playlist[]> {
    return await this.playlistService.findPlaylists(sub);
  }

  @Get('/:id')
  async getPlaylist(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<Playlist> {
    const playlist = await this.playlistService.findPlaylist(id);

    if (!playlist || (!playlist.public && playlist.ownerId !== sub)) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }

  @Patch('/:id')
  async updatePlaylist(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.updatePlaylist(id, sub, playlistDto.name);
  }

  @Delete('/:id')
  async deletePlaylist(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.playlistService.deletePlaylist(id, sub);
  }

  @Get('/:id/tracks')
  async getPlaylistTracks(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistTrack[]> {
    return await this.playlistService.getPlaylistTracks(id, sub);
  }

  @Post('/:id/tracks/:trackId')
  async addPlaylistTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.addPlaylistTrack(id, sub, trackId);
  }

  @Get('/:id/tracks/:trackId')
  async getPlaylistTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<PlaylistTrack | null> {
    const playlistTrack = await this.playlistService.getPlaylistTrack(
      id,
      sub,
      trackId,
    );

    if (!playlistTrack) {
      throw new NotFoundException('Playlist tracks not found');
    }
    return playlistTrack;
  }

  @Delete('/:id/tracks/:trackId')
  async deletePlaylistTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.deletePlaylistTrack(id, sub, trackId);
  }
}
