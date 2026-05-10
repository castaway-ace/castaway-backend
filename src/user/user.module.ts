import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { UserController } from './user.controller.js';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [UserService, PrismaService, JwtService, ConfigService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
