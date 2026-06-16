import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [GuardModule],
  controllers: [InteractionsController],
  providers: [InteractionsService, PrismaService],
})
export class InteractionsModule {}
