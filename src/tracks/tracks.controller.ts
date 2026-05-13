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
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { TracksService } from './tracks.service.js';
import { Track } from '../../generated/prisma/client.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { TrackQueryDto } from '../dto/track-query.dto.js';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  async getTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TrackQueryDto,
  ): Promise<Track[]> {
    return this.trackService.findTracks(user.sub, {
      filters: {
        artistIds: query.artistIds,
        albumIds: query.albumIds,
        genres: query.genres,
        starred: query.starred,
      },
      sort: query.sort
        ? { sort: query.sort, sortBy: query.sortBy ?? 'asc' }
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
    @Headers('range') range?: string,
  ): Promise<StreamableFile> {
    const trackStream = await this.trackService.findTrackStream(id, range);

    return new StreamableFile(trackStream);
  }

  @Post(':id/star')
  @HttpCode(204)
  async starTrack(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.trackService.updateTrackStar(id, user.sub, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStarTrack(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.trackService.updateTrackStar(id, user.sub, false);
  }
}
