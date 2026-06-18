import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GuardModule } from '../auth/guard.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { StorageService } from '../storage/storage.service.js';

@Module({
  imports: [GuardModule, PlaylistsModule],
  controllers: [InteractionsController],
  providers: [InteractionsService, PrismaService, StorageService],
})
export class InteractionsModule {}
