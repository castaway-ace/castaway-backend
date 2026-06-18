import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class StorageHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly storage: StorageService,
  ) {}

  async isHealthy(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('storage');

    const results = await this.storage.checkBuckets();
    const unhealthy = results.filter((r) => !r.healthy);

    const details = {
      totalBuckets: results.length,
      healthyBuckets: results.length - unhealthy.length,
      unhealthyBuckets: unhealthy.length,
      buckets: results,
    };

    return unhealthy.length > 0
      ? indicator.down(details)
      : indicator.up(details);
  }
}
