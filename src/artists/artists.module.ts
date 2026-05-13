import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Module({
  controllers: [ArtistsController],
  providers: [
    ArtistsService,
    PrismaService,
    StorageService,
    ConfigService,
    JwtService,
  ],
})
export class ArtistsModule {}
