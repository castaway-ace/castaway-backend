import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
import {
  CreateUploadSessionResponse,
  UploadFileTarget,
} from './upload-sessions.entity.js';
import type { UploadFileInput } from './upload-sessions.types.js';

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
    this.partSize = this.readPositiveInt(
      configService.get<string>('UPLOAD_PART_SIZE_BYTES'),
      DEFAULT_PART_SIZE_BYTES,
      'UPLOAD_PART_SIZE_BYTES',
    );
    this.presignTtlSeconds = this.readPositiveInt(
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

  private readPositiveInt(
    raw: string | undefined,
    fallback: number,
    name: string,
  ): number {
    if (raw === undefined || raw === '') {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid ${name} "${raw}": expected a positive integer`);
    }
    return value;
  }
}
