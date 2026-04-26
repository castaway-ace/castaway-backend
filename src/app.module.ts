import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
import { RefreshTokenModule } from './refresh-token/refresh-token.module.js';
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
    RefreshTokenModule,
  ],
})
export class AppModule {}
