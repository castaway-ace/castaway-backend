import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { TracksModule } from './tracks/tracks.module.js';
import { AlbumsModule } from './albums/albums.module.js';
import { ArtistsModule } from './artists/artists.module.js';
import { SearchModule } from './search/search.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StorageModule } from './storage/storage.module.js';
import { DeviceModule } from './device/device.module.js';
import { RefreshTokenModule } from './refresh-token/refresh-token.module.js';
import { InteractionsModule } from './interactions/interactions.module.js';
import { LibraryModule } from './library/library.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WhitelistModule } from './whitelist/whitelist.module.js';
import { QueueModule } from './queue/queue.module.js';
import { UploadSessionsModule } from './upload-sessions/upload-sessions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    ScheduleModule.forRoot(),
    QueueModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TracksModule,
    AlbumsModule,
    ArtistsModule,
    DeviceModule,
    SearchModule,
    PlaylistsModule,
    AdminModule,
    StorageModule,
    RefreshTokenModule,
    InteractionsModule,
    LibraryModule,
    WhitelistModule,
    UploadSessionsModule,
  ],
})
export class AppModule {}
