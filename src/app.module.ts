import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RefreshTokenModule } from './refresh-token/refresh-token.module.js';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    HealthModule,
    UserModule,
    AuthModule,
    RefreshTokenModule,
  ],
  controllers: [AppController],
  providers: [AppService, StorageService],
})
export class AppModule {}
