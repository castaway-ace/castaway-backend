import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { TracksService } from './tracks.service.js';
import { Track } from '../../generated/prisma/client.js';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  constructor(private readonly trackService: TracksService) {}

  @Get()
  async getTracks(): Promise<Track[]> {
    const tracks = await this.trackService.findTracks();

    if (!tracks) return [];

    return tracks;
  }
}
