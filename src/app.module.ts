import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { TracksModule } from './tracks/tracks.module.js';
import { AlbumsModule } from './albums/albums.module.js';
import { ArtistsModule } from './artists/artists.module.js';
import { SearchModule } from './search/search.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SeedModule } from './seed/seed.module.js';
import { StorageModule } from './storage/storage.module.js';
import { DeviceModule } from './device/device.module.js';
import { RefreshTokenModule } from './refresh-token/refresh-token.module.js';
import { InteractionsModule } from './interactions/interactions.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UserModule,
    AuthModule,
    TracksModule,
    AlbumsModule,
    ArtistsModule,
    DeviceModule,
    SearchModule,
    PlaylistsModule,
    AdminModule,
    SeedModule,
    StorageModule,
    RefreshTokenModule,
    InteractionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
