import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { PlaylistsService } from './playlists.service.js';
import { PlaylistIdentity } from './playlists.types.js';
import {
  PlaylistEntity,
  PlaylistSummaryEntity,
  PlaylistTrackEntity,
} from './playlist.entity.js';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlaylistQueryDto } from './dto/playlist-query.dto.js';
import { CreatePlaylistDto } from './dto/create-playlist.dto.js';
import { PlaylistRef } from '../common/entities/references.entity.js';

@Controller('playlists')
@ApiBearerAuth()
@ApiTags('Playlists')
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

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

  @Post('')
  @ApiCreatedResponse({ type: PlaylistRef })
  async create(
    @CurrentUser('sub') sub: string,
    @Body() playlistDto: CreatePlaylistDto,
  ): Promise<PlaylistIdentity> {
    return this.playlistService.create(sub, playlistDto.name);
  }

  @Patch('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Playlist not found.' })
  async update(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
    @Body() playlistDto: CreatePlaylistDto,
  ): Promise<void> {
    await this.playlistService.update(sub, id, playlistDto.name);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Playlist not found.' })
  async delete(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.playlistService.delete(sub, id);
  }

  @Get('/:id/tracks')
  @ApiOkResponse({ type: PlaylistTrackEntity, isArray: true })
  @ApiNotFoundResponse({ description: 'Playlist not found.' })
  async findTracks(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistTrackEntity[]> {
    return await this.playlistService.findTracks(sub, id);
  }

  @Get('/:id/tracks/:trackId')
  @ApiOkResponse({ type: PlaylistTrackEntity })
  @ApiNotFoundResponse({ description: 'Playlist or track not found.' })
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

  @Post('/:id/tracks/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Playlist or track not found.' })
  async addTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') playlist_id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.addTrack(sub, playlist_id, trackId);
  }

  @Delete('/:id/tracks/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Playlist or track not found.' })
  async deleteTrack(
    @CurrentUser('sub') sub: string,
    @Param('id') playlist_id: string,
    @Param('trackId') trackId: string,
  ): Promise<void> {
    await this.playlistService.deleteTrack(sub, playlist_id, trackId);
  }
}
