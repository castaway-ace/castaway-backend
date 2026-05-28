import {
  Headers,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
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
import { Track } from '../../generated/prisma/client.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { TrackQueryDto } from '../dto/track.dto.js';
import { Tracks } from '../types/tracks.js';
import type { Response } from 'express';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  async getTracks(
    @CurrentUser('sub') sub: string,
    @Query() query: TrackQueryDto,
  ): Promise<Tracks> {
    return this.trackService.findTracks(sub, {
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

  @Get(':id')
  async getTrack(@Param('id') id: string): Promise<Track> {
    const track = await this.trackService.findTrack(id);

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    return track;
  }

  @Get(':id/stream')
  async getTrackStream(
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
  async starTrack(
    @Param('id') id: string,
    @CurrentUser('sub') sub: string,
  ): Promise<void> {
    await this.trackService.updateTrackStar(id, sub, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStarTrack(
    @Param('id') id: string,
    @CurrentUser('sub') sub: string,
  ): Promise<void> {
    await this.trackService.updateTrackStar(id, sub, false);
  }
}
