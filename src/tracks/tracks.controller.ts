import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { TracksService } from './tracks.service.js';
import { Track } from '../../generated/prisma/client.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  async getTracks(@CurrentUser() user: AuthenticatedUser): Promise<Track[]> {
    const tracks = await this.trackService.findTracks(user.sub, {});

    if (!tracks) return [];

    return tracks;
  }
}
