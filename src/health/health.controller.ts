import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { StorageHealthIndicator } from './storage.health.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

@Controller('health')
@UseGuards(AuthGuard, AdminGuard)
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private prisma: PrismaService,
    private storage: StorageHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.storage.isHealthy(),
    ]);
  }
}
