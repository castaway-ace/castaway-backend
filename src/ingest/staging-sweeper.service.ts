import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
import { parsePositiveIntEnv } from '../common/env.js';
import {
  ALBUM_INGEST_JOB,
  ALBUM_INGEST_JOB_OPTIONS,
  ALBUM_INGEST_QUEUE,
} from '../common/constants.js';
import { ImportSessionStatus } from '../generated/prisma/enums.js';

const DEFAULT_SESSION_TTL_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;
// A QUEUED session whose BullMQ job has vanished (e.g. Redis was flushed) is
// re-enqueued after this grace period; Postgres is the source of truth.
const REQUEUE_AFTER_MS = 15 * 60 * 1000;
// Terminal sessions are kept this long as an audit trail, then deleted.
const TERMINAL_RETENTION_MS = 30 * 24 * HOUR_MS;

/**
 * Hourly housekeeping for upload sessions (worker-hosted). Expires abandoned
 * uploads, re-enqueues QUEUED sessions whose job was lost, and prunes old
 * terminal sessions. All branches are best-effort and never throw out of the
 * cron tick.
 */
@Injectable()
export class StagingSweeperService {
  private readonly logger = new Logger(StagingSweeperService.name);
  private readonly sessionTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectQueue(ALBUM_INGEST_QUEUE) private readonly ingestQueue: Queue,
    configService: ConfigService,
  ) {
    const ttlHours = parsePositiveIntEnv(
      configService.get<string>('UPLOAD_SESSION_TTL_HOURS'),
      DEFAULT_SESSION_TTL_HOURS,
      'UPLOAD_SESSION_TTL_HOURS',
    );
    this.sessionTtlMs = ttlHours * HOUR_MS;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    await this.expireAbandoned();
    await this.requeueOrphaned();
    await this.pruneTerminal();
  }

  /** PENDING_UPLOAD sessions past the TTL: abort uploads, clear staging, ABORT. */
  async expireAbandoned(): Promise<void> {
    const cutoff = new Date(Date.now() - this.sessionTtlMs);
    const sessions = await this.prisma.importSession.findMany({
      where: {
        status: ImportSessionStatus.PENDING_UPLOAD,
        createdAt: { lt: cutoff },
      },
      include: { files: true },
    });

    for (const session of sessions) {
      try {
        const aborts: Promise<void>[] = [];
        for (const file of session.files) {
          if (file.uploadId && !file.uploadedAt) {
            aborts.push(
              this.storageService
                .abortMultipartUpload(
                  StorageBucket.Staging,
                  file.objectKey,
                  file.uploadId,
                )
                .catch(() => undefined),
            );
          }
        }
        await Promise.all(aborts);
        await this.storageService.deletePrefix(
          StorageBucket.Staging,
          `${session.id}/`,
        );
        await this.prisma.importSession.update({
          where: { id: session.id },
          data: {
            status: ImportSessionStatus.ABORTED,
            finishedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to expire abandoned session ${session.id}: ${this.msg(error)}`,
        );
      }
    }

    if (sessions.length > 0) {
      this.logger.log(`Expired ${sessions.length} abandoned upload session(s)`);
    }
  }

  /** QUEUED sessions past the grace period whose BullMQ job is gone: re-enqueue. */
  async requeueOrphaned(): Promise<void> {
    const cutoff = new Date(Date.now() - REQUEUE_AFTER_MS);
    const sessions = await this.prisma.importSession.findMany({
      where: {
        status: ImportSessionStatus.QUEUED,
        queuedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    let requeued = 0;
    for (const session of sessions) {
      try {
        const existing = await this.ingestQueue.getJob(session.id);
        if (!existing) {
          await this.ingestQueue.add(
            ALBUM_INGEST_JOB,
            { sessionId: session.id },
            { jobId: session.id, ...ALBUM_INGEST_JOB_OPTIONS },
          );
          requeued++;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to re-enqueue session ${session.id}: ${this.msg(error)}`,
        );
      }
    }

    if (requeued > 0) {
      this.logger.log(`Re-enqueued ${requeued} orphaned QUEUED session(s)`);
    }
  }

  /** Deletes terminal sessions past the retention window (cascades to files). */
  async pruneTerminal(): Promise<void> {
    const cutoff = new Date(Date.now() - TERMINAL_RETENTION_MS);
    const { count } = await this.prisma.importSession.deleteMany({
      where: {
        status: {
          in: [
            ImportSessionStatus.COMPLETED,
            ImportSessionStatus.FAILED,
            ImportSessionStatus.ABORTED,
          ],
        },
        finishedAt: { lt: cutoff },
      },
    });

    if (count > 0) {
      this.logger.log(`Pruned ${count} old terminal upload session(s)`);
    }
  }

  private msg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
