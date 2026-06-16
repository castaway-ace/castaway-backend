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
import { PlaylistDto } from '../dto/playlist.dto.js';
import {
  Playlist,
  PlaylistSummary,
  PlaylistTrack,
} from '../types/playlists.js';

@Controller('playlists')
@UseGuards(AuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Get('/:id')
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<Playlist> {
    const playlist = await this.playlistService.find(id);

    if (!playlist || playlist.ownerId !== sub) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }

  @Get('')
  async findAll(@CurrentUser('sub') sub: string): Promise<PlaylistSummary[]> {
    return await this.playlistService.findAll(sub);
  }

  @Post('')
  async create(
    @CurrentUser('sub') sub: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.create(sub, playlistDto.name);
  }

  @Patch('/:id')
  async update(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<void> {
    await this.playlistService.update(sub, id, playlistDto.name);
  }

  @Delete('/:id')
  async delete(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.playlistService.delete(sub, id);
  }

  @Get('/:id/tracks/:trackId')
  async findTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<PlaylistTrack> {
    const playlistTrack = await this.playlistService.findTrack(
      sub,
      id,
      trackId,
    );

    if (!playlistTrack) {
      throw new NotFoundException('Playlist tracks not found');
    }
    return playlistTrack;
  }

  @Get('/:id/tracks')
  async findTracks(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistTrack[]> {
    return await this.playlistService.findTracks(sub, id);
  }

  @Post('/:id/tracks/:trackId')
  async addTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.addTrack(sub, id, trackId);
  }

  @Delete('/:id/tracks/:trackId')
  async deleteTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.deleteTrack(sub, id, trackId);
  }
}
