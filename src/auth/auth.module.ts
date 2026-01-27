import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { FacebookStrategy } from './strategies/facebook.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    FacebookStrategy,
    JwtStrategy,
    PrismaService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
