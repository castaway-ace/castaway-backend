import { Module } from '@nestjs/common';
import { PlaylistService } from './playlist.service.js';
import { PlaylistController } from './playlist.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PlaylistRepository } from './playlist.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [PlaylistController],
  providers: [PlaylistService, PlaylistRepository],
})
export class PlaylistModule {}
