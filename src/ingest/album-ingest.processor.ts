import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ALBUM_INGEST_QUEUE } from '../common/constants.js';

/**
 * Consumes the album-ingest queue (concurrency 1 to keep the RAM-constrained
 * worker predictable). Skeleton for now: nothing enqueues jobs yet — the
 * finalize endpoint and the real parse/copy/persist pipeline land in a later
 * change. This only proves the worker connects and picks up work.
 */
@Processor(ALBUM_INGEST_QUEUE, { concurrency: 1 })
export class AlbumIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(AlbumIngestProcessor.name);

  process(job: Job): Promise<void> {
    this.logger.log(`Received album-ingest job ${job.id ?? '(unknown)'}`);
    return Promise.resolve();
  }
}
