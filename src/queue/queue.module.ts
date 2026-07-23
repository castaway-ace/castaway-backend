import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALBUM_INGEST_QUEUE } from '../ingest/ingest.constants.js';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  /**
   * BullMQ requires blocking commands to retry forever, so this must be null.
   * See https://docs.bullmq.io/guide/connections.
   */
  maxRetriesPerRequest: null;
}

/**
 * Parses `REDIS_URL` (e.g. `redis://redis:6379`, optionally with credentials)
 * into ioredis connection options for BullMQ. Throws at startup if the variable
 * is missing so a misconfiguration fails fast rather than at first job.
 */
export function buildRedisConnection(
  url: string | undefined,
): RedisConnectionOptions {
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }

  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Wires the shared BullMQ connection (from `REDIS_URL`) and registers the
 * album-ingest queue. Re-exports `BullModule` so both the API (producer) and
 * the worker (consumer) can inject the queue via `@InjectQueue`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisConnection(config.get<string>('REDIS_URL')),
      }),
    }),
    BullModule.registerQueue({ name: ALBUM_INGEST_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
