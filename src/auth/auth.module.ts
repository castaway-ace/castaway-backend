import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { DeviceModule } from '../device/device.module.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { GuardModule } from './guard.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';

@Module({
  imports: [
    UserModule,
    DeviceModule,
    PlaylistsModule,
    RefreshTokenModule,
    GuardModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
