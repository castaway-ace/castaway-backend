import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from './storage/storage.module.js';
import storageConfig from './config/storage.config.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import authConfig from './config/auth.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [storageConfig, authConfig],
    }),
    StorageModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
