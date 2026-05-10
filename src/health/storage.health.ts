import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

interface BucketCheckResult {
  bucket: string;
  healthy: boolean;
  error?: string;
  errorName?: string;
}

@Injectable()
export class StorageHealthIndicator {
  private client: S3Client;
  private buckets: string[];

  constructor(private readonly healthIndicatorService: HealthIndicatorService) {
    this.client = new S3Client({
      region: process.env.STORAGE_REGION!,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY!,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
      },
      endpoint: process.env.STORAGE_ENDPOINT!,
      forcePathStyle: true,
    });

    this.buckets = [
      process.env.STORAGE_TRACKS_BUCKET!,
      process.env.STORAGE_ALBUM_ART_BUCKET!,
      process.env.STORAGE_ARTIST_IMAGE_BUCKET!,
    ];
  }

  private async checkBucket(bucket: string): Promise<BucketCheckResult> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return {
        bucket,
        healthy: true,
      };
    } catch (error) {
      return {
        bucket,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : undefined,
      };
    }
  }

  async isHealthy(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check('storage');

    const results = await Promise.all(
      this.buckets.map((bucket) => this.checkBucket(bucket)),
    );

    const unhealthy = results.filter((r) => !r.healthy);

    const details = {
      totalBuckets: results.length,
      healthyBuckets: results.length - unhealthy.length,
      unhealthyBuckets: unhealthy.length,
      buckets: results,
    };

    if (unhealthy.length > 0) {
      return indicator.down(details);
    }

    return indicator.up(details);
  }
}
