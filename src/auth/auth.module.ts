import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { DeviceModule } from '../device/device.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { GuardModule } from './guard.module.js';

@Module({
  imports: [UserModule, DeviceModule, PlaylistsModule, GuardModule],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, RefreshTokenService, AuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
