import { Module } from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { TracksController } from './tracks.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [
    TracksService,
    PrismaService,
    StorageService,
    ConfigService,
    JwtService,
  ],
  controllers: [TracksController],
})
export class TracksModule {}
