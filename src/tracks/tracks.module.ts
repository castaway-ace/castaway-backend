import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { TracksController } from './tracks.controller.js';

@Module({
  providers: [TracksService],
  controllers: [TracksController],
})
export class TracksModule {}
