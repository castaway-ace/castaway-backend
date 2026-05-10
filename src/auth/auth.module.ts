import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../device/device.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';

@Module({
  imports: [UserModule, JwtModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    ConfigService,
    DeviceService,
    PrismaService,
    RefreshTokenService,
  ],
})
export class AuthModule {}
