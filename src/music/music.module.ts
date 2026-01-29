import { Module } from '@nestjs/common';
import { MusicController } from './music.controller.js';
import { MusicService } from './music.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { MusicRepository } from './music.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [MusicController],
  providers: [MusicService, MusicRepository],
})
export class MusicModule {}
