import { Module } from '@nestjs/common';
import { MusicController } from './music.controller.js';
import { MusicService } from './music.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  controllers: [MusicController],
  providers: [MusicService, PrismaService],
})
export class MusicModule {}
