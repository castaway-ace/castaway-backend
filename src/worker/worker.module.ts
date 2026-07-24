import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { HealthModule } from '../health/health.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { IngestModule } from '../ingest/ingest.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { AlbumIngestProcessor } from '../ingest/album-ingest.processor.js';

/**
 * Root module for the ingest worker process. It boots as a minimal HTTP app so
 * the existing `/health` endpoint and container healthcheck work, and hosts the
 * BullMQ processor that consumes the album-ingest queue. It shares Prisma,
 * Storage, and the queue connection with the API but registers no API routes.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    HealthModule,
    QueueModule,
    IngestModule,
    AlbumsModule,
  ],
  providers: [AlbumIngestProcessor],
})
export class WorkerModule {}
