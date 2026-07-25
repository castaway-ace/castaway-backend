import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { parseStream } from 'music-metadata';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
import { IngestService } from './ingest.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { extractRequiredTags, resolveSuffix } from '../admin/metadata.js';
import { ALBUM_INGEST_QUEUE } from '../common/constants.js';
import { ImportPhase, ImportSessionStatus } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ParsedTrackInput } from './ingest.types.js';

interface IngestJobData {
  sessionId: string;
}

interface StagedFile {
  objectKey: string;
  contentType: string;
  size: number;
}

/**
 * Consumes album-ingest jobs. For each session it parses the staged objects,
 * plans the album (deterministic id = session id for idempotency), copies the
 * objects server-side into the final buckets, persists the album, then clears
 * staging. Validation failures are unrecoverable; transient failures retry.
 */
@Processor(ALBUM_INGEST_QUEUE, { concurrency: 1 })
export class AlbumIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(AlbumIngestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly ingestService: IngestService,
    private readonly albumService: AlbumsService,
  ) {
    super();
  }

  async process(job: Job<IngestJobData>): Promise<void> {
    const { sessionId } = job.data;

    if (!(await this.claim(sessionId))) {
      this.logger.warn(`Session ${sessionId} is not runnable; skipping`);
      return;
    }

    const copiedKeys: string[] = [];
    let coverKey: string | null = null;

    try {
      const files = await this.loadFiles(sessionId);

      await this.setPhase(sessionId, ImportPhase.PARSING, 0, files.length);
      const parsed = await this.parseFiles(files);

      const plan = await this.ingestService.planAlbum(parsed, {
        albumId: sessionId,
      });
      coverKey = plan.coverKey;

      await this.setPhase(
        sessionId,
        ImportPhase.COPYING,
        0,
        plan.tracks.length,
      );
      if (plan.coverKey && plan.cover) {
        await this.albumService.uploadCover(plan.coverKey, plan.cover);
      }
      for (let index = 0; index < plan.tracks.length; index++) {
        await this.storageService.copyObject(
          StorageBucket.Staging,
          files[index].objectKey,
          StorageBucket.Tracks,
          plan.tracks[index].fileKey,
          files[index].contentType,
        );
        copiedKeys.push(plan.tracks[index].fileKey);
        await this.setProgress(sessionId, index + 1);
      }

      // Idempotent: the album id equals the session id, so a retry after a
      // crash-that-committed skips the insert instead of hitting the unique
      // identity conflict.
      await this.setPhase(sessionId, ImportPhase.PERSISTING);
      const existing = await this.prisma.album.findUnique({
        where: { id: sessionId },
        select: { id: true },
      });
      if (!existing) {
        await this.ingestService.persistImport(plan);
      }

      await this.setPhase(sessionId, ImportPhase.CLEANUP);
      await this.storageService.deletePrefix(
        StorageBucket.Staging,
        `${sessionId}/`,
      );
      await this.markCompleted(sessionId);
      this.logger.log(`Ingested album ${sessionId}`);
    } catch (error) {
      await this.ingestService
        .cleanupObjects(copiedKeys, coverKey)
        .catch(() => undefined);

      if (this.isPermanent(error)) {
        await this.failSession(sessionId, this.toErrorPayload(error));
        throw new UnrecoverableError(this.errorMessage(error));
      }
      // Transient: rethrow so BullMQ retries; `onFailed` records the failure
      // once retries are exhausted.
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<IngestJobData>): Promise<void> {
    // Only act once the job has truly failed (retries exhausted or
    // unrecoverable). The permanent path already recorded a structured error.
    if (!(await job.isFailed())) {
      return;
    }
    const { sessionId } = job.data;
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (session && session.status !== ImportSessionStatus.FAILED) {
      await this.failSession(sessionId, {
        code: 'INGEST_FAILED',
        message: job.failedReason ?? 'Ingest job failed',
      });
    }
  }

  /** Claims QUEUED or (on retry) PROCESSING sessions; skips terminal ones. */
  private async claim(sessionId: string): Promise<boolean> {
    const result = await this.prisma.importSession.updateMany({
      where: {
        id: sessionId,
        status: {
          in: [ImportSessionStatus.QUEUED, ImportSessionStatus.PROCESSING],
        },
      },
      data: {
        status: ImportSessionStatus.PROCESSING,
        phase: ImportPhase.PARSING,
        startedAt: new Date(),
      },
    });
    return result.count > 0;
  }

  private async loadFiles(sessionId: string): Promise<StagedFile[]> {
    return this.prisma.importFile.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { objectKey: true, contentType: true, size: true },
    });
  }

  private async parseFiles(files: StagedFile[]): Promise<ParsedTrackInput[]> {
    const parsed: ParsedTrackInput[] = [];
    for (const file of files) {
      const { stream } = await this.storageService.getObjectStream(
        StorageBucket.Staging,
        file.objectKey,
      );
      try {
        const metadata = await parseStream(stream, {
          mimeType: file.contentType,
          size: file.size,
        });
        parsed.push({
          tags: extractRequiredTags(metadata),
          suffix: resolveSuffix(file.contentType),
          size: file.size,
        });
      } finally {
        stream.destroy();
      }
    }
    return parsed;
  }

  private async setPhase(
    sessionId: string,
    phase: ImportPhase,
    progressCurrent?: number,
    progressTotal?: number,
  ): Promise<void> {
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: {
        phase,
        ...(progressCurrent !== undefined ? { progressCurrent } : {}),
        ...(progressTotal !== undefined ? { progressTotal } : {}),
      },
    });
  }

  private async setProgress(
    sessionId: string,
    progressCurrent: number,
  ): Promise<void> {
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: { progressCurrent },
    });
  }

  private async markCompleted(sessionId: string): Promise<void> {
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: ImportSessionStatus.COMPLETED,
        phase: null,
        albumId: sessionId,
        finishedAt: new Date(),
      },
    });
  }

  private async failSession(
    sessionId: string,
    error: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: {
        status: ImportSessionStatus.FAILED,
        error,
        finishedAt: new Date(),
      },
    });
    await this.storageService
      .deletePrefix(StorageBucket.Staging, `${sessionId}/`)
      .catch(() => undefined);
  }

  private isPermanent(error: unknown): boolean {
    return (
      error instanceof BadRequestException || error instanceof ConflictException
    );
  }

  private toErrorPayload(error: unknown): Prisma.InputJsonObject {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      return typeof response === 'string'
        ? { message: response }
        : { ...response };
    }
    return { message: this.errorMessage(error) };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
