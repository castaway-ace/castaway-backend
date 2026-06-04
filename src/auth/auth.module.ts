import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { DeviceModule } from '../device/device.module.js';

@Module({
  imports: [UserModule, DeviceModule, JwtModule],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, RefreshTokenService, AuthGuard],
  exports: [AuthGuard, JwtModule, AuthService],
})
export class AuthModule {}
