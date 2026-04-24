import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './storage/storage.module.js';
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    StorageModule,
  ],
})
export class AppModule {}
