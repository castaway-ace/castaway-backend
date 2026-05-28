import { Module } from '@nestjs/common';
import { SeedService } from './seed.service.js';
import { UserService } from '../user/user.service.js';
import { AdminService } from '../admin/admin.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AuthService } from '../auth/auth.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { DeviceService } from '../device/device.service.js';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    SeedService,
    UserService,
    AdminService,
    AuthService,
    RefreshTokenService,
    DeviceService,
    JwtService,
    ConfigService,
    PrismaService,
    StorageService,
    TracksService,
    AlbumsService,
    ArtistsService,
  ],
})
export class SeedModule {}
