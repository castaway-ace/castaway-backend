import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { PlaylistsService } from './playlists.service.js';
import { PlaylistDto, PlaylistQueryDto } from '../dto/playlist.dto.js';
import { PlaylistIdentity } from './playlists.types.js';
import {
  PlaylistEntity,
  PlaylistSummaryEntity,
  PlaylistTrackEntity,
} from './playlist.entity.js';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('playlists')
@UseGuards(AuthGuard)
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Get('/:id')
  @ApiOkResponse({ type: PlaylistEntity })
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistEntity> {
    const playlist = await this.playlistService.find(id);

    if (playlist.ownerId !== sub) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }

  @Get('')
  @ApiOkResponse({ type: PlaylistSummaryEntity, isArray: true })
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: PlaylistQueryDto,
  ): Promise<PlaylistSummaryEntity[]> {
    return await this.playlistService.findAll(sub, {
      filters: {
        onlyUser: query.onlyUser,
      },
      orderOptions: query.order
        ? { order: query.order, orderBy: query.orderBy ?? 'asc' }
        : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Post('')
  async create(
    @CurrentUser('sub') sub: string,
    @Body() playlistDto: PlaylistDto,
  ): Promise<PlaylistIdentity> {
    return this.playlistService.create(sub, playlistDto.name);
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
  ): Promise<PlaylistTrackEntity> {
    const playlistTrack = await this.playlistService.findTrack(
      sub,
      id,
      trackId,
    );
    return playlistTrack;
  }

  @Get('/:id/tracks')
  @ApiOkResponse({ type: PlaylistTrackEntity, isArray: true })
  async findTracks(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistTrackEntity[]> {
    return await this.playlistService.findTracks(sub, id);
  }

  @Post('/:id/tracks/:trackId')
  async addTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') playlist_id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.addTrack(sub, playlist_id, trackId);
  }

  @Delete('/:id/tracks/:trackId')
  async deleteTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') playlist_id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.deleteTrack(sub, playlist_id, trackId);
  }
}
