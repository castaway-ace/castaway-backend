import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [UserService, PrismaService, JwtService],
  exports: [UserService],
})
export class UserModule {}
