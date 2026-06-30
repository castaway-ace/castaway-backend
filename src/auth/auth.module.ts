import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { DeviceModule } from '../device/device.module.js';
import { GuardModule } from './guard.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';

@Module({
  imports: [UsersModule, DeviceModule, RefreshTokenModule, GuardModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
