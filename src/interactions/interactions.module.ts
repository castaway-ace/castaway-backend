import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [InteractionsController],
  providers: [InteractionsService, PrismaService],
})
export class InteractionsModule {}
