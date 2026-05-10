import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [JwtModule],
  providers: [RefreshTokenService, PrismaService, ConfigService],
  exports: [RefreshTokenService],
})
export class RefreshTokenModule {}
