import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { TracksController } from './tracks.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [StorageModule, AuthModule],
  providers: [TracksService, PrismaService],
  controllers: [TracksController],
  exports: [TracksService],
})
export class TracksModule {}
