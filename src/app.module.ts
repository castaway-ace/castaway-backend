import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module.js';
import storageConfig from './config/storage.config.js';
import { AuthModule } from './auth/auth.module.js';
import authConfig from './config/auth.config.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MusicModule } from './music/music.module.js';
import { PlaylistModule } from './playlist/playlist.module.js';
import { UserService } from './user/user.service.js';
import { UserModule } from './user/user.module.js';
import { RefreshTokenModule } from './refresh-token/refresh-token.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [storageConfig, authConfig],
    }),
    StorageModule,
    AuthModule,
    PrismaModule,
    MusicModule,
    PlaylistModule,
    UserModule,
    RefreshTokenModule,
  ],
  providers: [],
})
export class AppModule {}
