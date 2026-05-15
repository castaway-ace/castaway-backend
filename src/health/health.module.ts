import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller.js';
import { StorageHealthIndicator } from './storage.health.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [StorageHealthIndicator, PrismaService, JwtService, ConfigService],
})
export class HealthModule {}
