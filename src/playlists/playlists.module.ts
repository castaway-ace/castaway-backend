import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [PlaylistsController],
  providers: [
    PlaylistsService,
    PrismaService,
    TracksService,
    StorageService,
    ConfigService,
    JwtService,
  ],
})
export class PlaylistsModule {}
