import { Module } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../users/user.module.js';

@Module({
  imports: [JwtModule, UserModule],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class RefreshTokenModule {}
