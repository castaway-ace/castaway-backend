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
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { TracksService } from './tracks.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { TrackQueryDto } from '../dto/track.dto.js';
import { Track, TrackSummary } from '../types/tracks.js';
import type { Response } from 'express';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: TrackQueryDto,
  ): Promise<TrackSummary[]> {
    return this.trackService.findAll(sub, {
      filters: {
        artistIds: query.artistIds,
        albumIds: query.albumIds,
        genres: query.genres,
        starred: query.starred,
        search: query.search,
      },
      orderOptions: query.order
        ? { order: query.order, orderBy: query.orderBy ?? 'asc' }
        : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get('starred')
  async getStarred(@CurrentUser('sub') sub: string): Promise<string[]> {
    return this.trackService.findStarredTrackIds(sub);
  }

  @Get(':id')
  async find(@Param('id') id: string): Promise<Track> {
    const track = await this.trackService.find(id);

    return track;
  }

  @Get(':id/stream')
  async findTrackStream(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('range') range?: string,
  ): Promise<StreamableFile> {
    const { stream, contentType, contentLength, contentRange } =
      await this.trackService.findTrackStream(id, range);

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
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.trackService.updateStar(sub, id, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.trackService.updateStar(sub, id, false);
  }
}
