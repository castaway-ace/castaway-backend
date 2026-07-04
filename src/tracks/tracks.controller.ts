import {
  Headers,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  StreamableFile,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { TrackQueryDto } from './dto/track-query.dto.js';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TrackEntity, TrackSummaryEntity } from './tracks.entity.js';

@Controller('tracks')
@ApiBearerAuth()
@ApiTags('Tracks')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  @ApiOkResponse({ type: TrackSummaryEntity, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: TrackQueryDto,
  ): Promise<TrackSummaryEntity[]> {
    return this.trackService.findAll(sub, {
      filters: {
        artistIds: query.artistIds,
        albumIds: query.albumIds,
        genres: query.genres,
        starred: query.starred,
        search: query.search,
      },
      sortOptions:
        query.order || query.orderBy
          ? { order: query.order ?? 'title', orderBy: query.orderBy ?? 'asc' }
          : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: TrackEntity })
  @ApiNotFoundResponse({ description: 'Track not found.' })
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<TrackEntity> {
    const track = await this.trackService.find(sub, id);

    return track;
  }

  @Get(':id/stream')
  @ApiProduces('audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/wav')
  @ApiOkResponse({
    description: 'Audio stream. Returns 206 Partial Content when Range is set.',
  })
  @ApiNotFoundResponse({ description: 'Track not found.' })
  async getTrackStream(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('range') range?: string,
  ): Promise<StreamableFile> {
    const { stream, contentType, contentLength, contentRange } =
      await this.trackService.getTrackStream(id, range);

    res.set({ 'Accept-Ranges': 'bytes' });

    if (range && contentRange) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.set({ 'Content-Range': contentRange });
    }

    return new StreamableFile(stream, {
      type: contentType,
      length: contentLength,
    });
  }

  @Post(':id/star')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Track not found.' })
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.trackService.updateStar(sub, id, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Track not found.' })
  async unstar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.trackService.updateStar(sub, id, false);
  }
}
