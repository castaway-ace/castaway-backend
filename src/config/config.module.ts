import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { appConfig } from './app.config.js';
import { authConfig } from './auth.config.js';
import { databaseConfig } from './database.config.js';
import { storageConfig } from './storage.config.js';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, authConfig, databaseConfig, storageConfig],
    }),
  ],
})
export class ConfigModule {}