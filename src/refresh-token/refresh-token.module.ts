import { Module } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { WhitelistModule } from '../whitelist/whitelist.module.js';

@Module({
  imports: [JwtModule, UsersModule, WhitelistModule],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class RefreshTokenModule {}
