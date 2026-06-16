import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [
    StorageModule,
    TracksModule,
    AlbumsModule,
    ArtistsModule,
    GuardModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
