import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AlbumsModule } from '../albums/albums.module.js';

@Module({
  imports: [StorageModule, AlbumsModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
