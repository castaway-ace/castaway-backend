import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { QueueRepository } from './queue.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [QueueService, QueueRepository],
})
export class QueueModule {}
