import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    ArtistsService,
    TracksService,
    AlbumsService,
    PrismaService,
    StorageService,
    ConfigService,
    JwtService,
  ],
})
export class SearchModule {}
