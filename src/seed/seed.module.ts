import { Module } from '@nestjs/common';
import { SeedService } from './seed.service.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { DeviceService } from '../device/device.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserModule } from '../user/user.module.js';
import { AdminModule } from '../admin/admin.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(),
    StorageModule,
    AuthModule,
    UserModule,
    AdminModule,
    TracksModule,
    AlbumsModule,
    ArtistsModule,
  ],
  providers: [SeedService, RefreshTokenService, DeviceService, PrismaService],
})
export class SeedModule {}
