import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [JwtModule, UserModule],
  providers: [RefreshTokenService, PrismaService],
  exports: [RefreshTokenService],
})
export class RefreshTokenModule {}
