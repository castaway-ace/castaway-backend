import { Module } from '@nestjs/common';
import { WhitelistController } from './whitelist.controller.js';
import { WhitelistService } from './whitelist.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WhitelistController],
  providers: [WhitelistService],
  exports: [WhitelistService],
})
export class WhitelistModule {}
