import { Module } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  providers: [RefreshTokenService],
})
export class RefreshTokenModule {}
