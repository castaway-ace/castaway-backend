import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [StorageModule, AlbumsModule, GuardModule],
  controllers: [ArtistsController],
  providers: [ArtistsService, PrismaService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
