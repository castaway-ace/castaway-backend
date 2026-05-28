import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage/storage.service.js';
import { TracksModule } from './tracks/tracks.module.js';
import { AlbumsModule } from './albums/albums.module.js';
import { ArtistsModule } from './artists/artists.module.js';
import { SearchModule } from './search/search.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SeedModule } from './seed/seed.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HealthModule,
    UserModule,
    AuthModule,
    TracksModule,
    AlbumsModule,
    ArtistsModule,
    SearchModule,
    PlaylistsModule,
    AdminModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService, StorageService],
})
export class AppModule {}
