import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { PlaylistsService } from './playlists.service.js';
import {
  PlaylistEntity,
  PlaylistSummaryEntity,
  PlaylistTrackEntity,
} from './playlist.entity.js';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PlaylistQueryDto } from './dto/playlist-query.dto.js';
import { CreatePlaylistDto } from './dto/create-playlist.dto.js';
import { PlaylistRef } from '../common/entities/references.entity.js';

@Controller('playlists')
@ApiBearerAuth()
@ApiTags('Playlists')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class PlaylistsController {
  constructor(private readonly playlistService: PlaylistsService) {}

  @Get()
  @ApiOkResponse({ type: PlaylistSummaryEntity, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
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
  @ApiNotFoundResponse({ description: 'Playlist not found.' })
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<PlaylistEntity> {
    return this.playlistService.find(sub, id);
  }

  @Post()
  @ApiCreatedResponse({ type: PlaylistRef })
  @ApiBadRequestResponse({ description: 'Invalid playlist name.' })
  async create(
    @CurrentUser('sub') sub: string,
    @Body() playlistDto: CreatePlaylistDto,
  ): Promise<PlaylistRef> {
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
    return await this.playlistService.findTrack(sub, id, trackId);
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
