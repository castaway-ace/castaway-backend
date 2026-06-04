import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserController } from './user.controller.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [UserService, PrismaService, JwtService, ConfigService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
