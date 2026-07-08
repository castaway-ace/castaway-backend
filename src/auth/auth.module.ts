import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { DeviceModule } from '../device/device.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard.js';
import { JwtModule } from '@nestjs/jwt';
import { WhitelistModule } from '../whitelist/whitelist.module.js';

@Module({
  imports: [
    JwtModule,
    UsersModule,
    DeviceModule,
    RefreshTokenModule,
    WhitelistModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
