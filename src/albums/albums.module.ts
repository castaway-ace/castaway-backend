import { Module } from '@nestjs/common';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Module({
  providers: [
    AlbumsService,
    PrismaService,
    StorageService,
    ConfigService,
    JwtService,
  ],
  controllers: [AlbumsController],
})
export class AlbumsModule {}
