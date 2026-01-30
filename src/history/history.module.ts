import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HistoryRepository } from './history.repository.js';
import { MusicRepository } from '../music/music.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [HistoryController],
  providers: [HistoryService, HistoryRepository, MusicRepository],
})
export class HistoryModule {}
