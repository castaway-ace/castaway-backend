import { Module } from '@nestjs/common';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TracksService } from '../tracks/tracks.service.js';

@Module({
  imports: [StorageModule, AuthModule],
  providers: [AlbumsService, TracksService, PrismaService],
  controllers: [AlbumsController],
  exports: [AlbumsService],
})
export class AlbumsModule {}
