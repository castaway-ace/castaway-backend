import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    JwtService,
    ConfigService,
    StorageService,
    TracksService,
    AlbumsService,
    ArtistsService,
    PrismaService,
  ],
})
export class AdminModule {}
