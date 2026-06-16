import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [
    StorageModule,
    GuardModule,
    ArtistsModule,
    TracksModule,
    AlbumsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, PrismaService],
})
export class SearchModule {}
