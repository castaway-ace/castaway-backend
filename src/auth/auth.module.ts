import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../device/device.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  imports: [UserModule, RefreshTokenModule, JwtModule],
  controllers: [AuthController],
  providers: [AuthService, ConfigService, DeviceService, PrismaService],
})
export class AuthModule {}
