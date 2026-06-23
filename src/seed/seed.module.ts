import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UserModule } from '../user/user.module.js';
import { SeedService } from './seed.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, UserModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [SeedService],
})
export class SeedModule {}
