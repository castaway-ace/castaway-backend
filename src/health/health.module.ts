import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { StorageHealthIndicator } from './storage.health.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [TerminusModule, StorageModule],
  controllers: [HealthController],
  providers: [StorageHealthIndicator],
})
export class HealthModule {}
