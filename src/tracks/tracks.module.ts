import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { TracksController } from './tracks.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';

@Module({
  imports: [StorageModule, PlaylistsModule],
  providers: [TracksService],
  controllers: [TracksController],
  exports: [TracksService],
})
export class TracksModule {}
