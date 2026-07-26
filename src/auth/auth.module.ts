import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { DeviceModule } from '../device/device.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './guards/auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
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
    // Order matters: AuthGuard runs first and populates request.user from the
    // verified JWT; PermissionsGuard runs next and enforces @RequirePermissions.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AuthModule {}
