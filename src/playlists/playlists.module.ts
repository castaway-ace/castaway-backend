import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { GuardModule } from '../auth/guard.module.js';
import { AlbumsModule } from '../albums/albums.module.js';

@Module({
  imports: [StorageModule, AlbumsModule, GuardModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
