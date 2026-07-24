import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
import { parsePositiveIntEnv } from '../common/env.js';
import { ImportSessionStatus } from '../generated/prisma/enums.js';
import {
  CreateUploadSessionResponse,
  UploadFileTarget,
  UploadSessionFileStatus,
  UploadSessionStatusResponse,
} from './upload-sessions.entity.js';
import type {
  CompletedPart,
  UploadFileInput,
} from './upload-sessions.types.js';

// 64 MiB keeps each part well under Cloudflare Tunnel's ~100 MB request cap
// while staying above S3's 5 MiB multipart minimum.
const DEFAULT_PART_SIZE_BYTES = 64 * 1024 * 1024;
const DEFAULT_PRESIGN_TTL_SECONDS = 6 * 60 * 60;

interface StartedUpload {
  objectKey: string;
  uploadId: string;
}

interface PlannedFile {
  fileId: string;
  originalName: string;
  contentType: string;
  size: number;
  objectKey: string;
  uploadId: string | null;
  partCount: number | null;
  target: UploadFileTarget;
}

@Injectable()
export class UploadSessionsService {
  private readonly partSize: number;
  private readonly presignTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    this.partSize = parsePositiveIntEnv(
      configService.get<string>('UPLOAD_PART_SIZE_BYTES'),
      DEFAULT_PART_SIZE_BYTES,
      'UPLOAD_PART_SIZE_BYTES',
    );
    this.presignTtlSeconds = parsePositiveIntEnv(
      configService.get<string>('UPLOAD_PRESIGN_TTL_SECONDS'),
      DEFAULT_PRESIGN_TTL_SECONDS,
      'UPLOAD_PRESIGN_TTL_SECONDS',
    );
  }

  /**
   * Opens an upload session: presigns direct-to-storage URLs for every file
   * (a single PUT for small files, multipart parts for large ones) and records
   * the session and its files. Part-URL signing is a local HMAC operation, so
   * every URL is issued up front in one response.
   */
  async createSession(
    files: UploadFileInput[],
    createdBy: string,
  ): Promise<CreateUploadSessionResponse> {
    const sessionId = randomUUID();
    const started: StartedUpload[] = [];

    try {
      const planned = await Promise.all(
        files.map((file) => this.planFile(sessionId, file, started)),
      );

      await this.prisma.importSession.create({
        data: {
          id: sessionId,
          createdBy,
          partSize: this.partSize,
          progressTotal: files.length,
          files: {
            create: planned.map((file) => ({
              id: file.fileId,
              originalName: file.originalName,
              contentType: file.contentType,
              size: file.size,
              objectKey: file.objectKey,
              uploadId: file.uploadId,
              partCount: file.partCount,
            })),
          },
        },
      });

      return {
        sessionId,
        partSize: this.partSize,
        expiresAt: new Date(Date.now() + this.presignTtlSeconds * 1000),
        files: planned.map((file) => file.target),
      };
    } catch (error) {
      // No session row exists to sweep these, so abort any multipart uploads
      // opened before the failure. Best-effort: never mask the original error.
      await Promise.all(
        started.map((upload) =>
          this.storageService
            .abortMultipartUpload(
              StorageBucket.Staging,
              upload.objectKey,
              upload.uploadId,
            )
            .catch(() => undefined),
        ),
      );
      throw error;
    }
  }

  private async planFile(
    sessionId: string,
    file: UploadFileInput,
    started: StartedUpload[],
  ): Promise<PlannedFile> {
    const fileId = randomUUID();
    const objectKey = `${sessionId}/${fileId}`;
    const partCount = Math.ceil(file.size / this.partSize);

    if (partCount <= 1) {
      const url = await this.storageService.presignPutObject(
        StorageBucket.Staging,
        objectKey,
        file.contentType,
        this.presignTtlSeconds,
      );
      return {
        fileId,
        originalName: file.name,
        contentType: file.contentType,
        size: file.size,
        objectKey,
        uploadId: null,
        partCount: null,
        target: { fileId, name: file.name, mode: 'single', url },
      };
    }

    const uploadId = await this.storageService.createMultipartUpload(
      StorageBucket.Staging,
      objectKey,
      file.contentType,
    );
    started.push({ objectKey, uploadId });

    const parts = await Promise.all(
      Array.from({ length: partCount }, (_, index) => index + 1).map(
        async (partNumber) => ({
          partNumber,
          url: await this.storageService.presignUploadPart(
            StorageBucket.Staging,
            objectKey,
            uploadId,
            partNumber,
            this.presignTtlSeconds,
          ),
        }),
      ),
    );

    return {
      fileId,
      originalName: file.name,
      contentType: file.contentType,
      size: file.size,
      objectKey,
      uploadId,
      partCount,
      target: { fileId, name: file.name, mode: 'multipart', uploadId, parts },
    };
  }

  /**
   * Finalizes one file's upload: completes the multipart upload (or verifies a
   * single PUT), checks the stored size matches what was declared, and records
   * `uploadedAt`. Idempotent — a file already marked uploaded is returned as-is.
   */
  async completeFile(
    sessionId: string,
    fileId: string,
    parts: CompletedPart[],
  ): Promise<UploadSessionFileStatus> {
    const file = await this.prisma.importFile.findFirst({
      where: { id: fileId, sessionId },
    });
    if (!file) {
      throw new NotFoundException('Upload file not found');
    }

    if (file.uploadedAt) {
      return this.toFileStatus(file);
    }

    if (file.uploadId) {
      if (parts.length === 0) {
        throw new BadRequestException(
          'A multipart upload requires at least one completed part',
        );
      }
      await this.storageService.completeMultipartUpload(
        StorageBucket.Staging,
        file.objectKey,
        file.uploadId,
        parts.map((part) => ({
          partNumber: part.partNumber,
          etag: this.normalizeEtag(part.etag),
        })),
      );
    }

    const { contentLength } = await this.storageService.headObject(
      StorageBucket.Staging,
      file.objectKey,
    );
    if (contentLength !== file.size) {
      await this.storageService.deleteObjectQuietly(
        StorageBucket.Staging,
        file.objectKey,
        `size mismatch for ${file.objectKey}`,
      );
      throw new BadRequestException(
        `Uploaded size ${contentLength} does not match the declared size ${file.size}`,
      );
    }

    const updated = await this.prisma.importFile.update({
      where: { id: fileId },
      data: { uploadedAt: new Date() },
    });
    return this.toFileStatus(updated);
  }

  /** Returns the full session status for polling. */
  async getStatus(sessionId: string): Promise<UploadSessionStatusResponse> {
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      include: { files: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    return {
      sessionId: session.id,
      status: session.status,
      phase: session.phase,
      progress: {
        current: session.progressCurrent,
        total: session.progressTotal,
      },
      error: session.error,
      albumId: session.albumId,
      createdAt: session.createdAt,
      finishedAt: session.finishedAt,
      files: session.files.map((file) => this.toFileStatus(file)),
    };
  }

  /**
   * Aborts a session that has not started processing: cancels any in-progress
   * multipart uploads, deletes staged objects, and marks the session ABORTED.
   */
  async abortSession(sessionId: string): Promise<void> {
    const session = await this.prisma.importSession.findUnique({
      where: { id: sessionId },
      include: { files: true },
    });
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (
      session.status === ImportSessionStatus.PROCESSING ||
      session.status === ImportSessionStatus.COMPLETED
    ) {
      throw new ConflictException(
        `Cannot abort a session that is ${session.status}`,
      );
    }

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
      `${sessionId}/`,
    );

    await this.prisma.importSession.update({
      where: { id: sessionId },
      data: { status: ImportSessionStatus.ABORTED, finishedAt: new Date() },
    });
  }

  private normalizeEtag(etag: string): string {
    const unquoted = etag.trim().replace(/^"+|"+$/g, '');
    return `"${unquoted}"`;
  }

  private toFileStatus(file: {
    id: string;
    originalName: string;
    size: number;
    uploadedAt: Date | null;
  }): UploadSessionFileStatus {
    return {
      fileId: file.id,
      name: file.originalName,
      size: file.size,
      uploadedAt: file.uploadedAt,
    };
  }
}
