import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [StorageModule, GuardModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService, PrismaService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
