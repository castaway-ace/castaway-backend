import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { UploadSessionsService } from './upload-sessions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
import type { Queue } from 'bullmq';
import type { UploadFileInput } from './upload-sessions.types.js';

interface CreateArgs {
  data: {
    id: string;
    createdBy: string;
    partSize: number;
    progressTotal: number;
    files: {
      create: Array<{
        id: string;
        objectKey: string;
        uploadId: string | null;
        partCount: number | null;
      }>;
    };
  };
}

describe('UploadSessionsService', () => {
  const createSessionRow = jest.fn<(args: unknown) => Promise<unknown>>();
  const findSessionRow = jest.fn<(args: unknown) => Promise<unknown>>();
  const updateSessionRow = jest.fn<(args: unknown) => Promise<unknown>>();
  const findFileRow = jest.fn<(args: unknown) => Promise<unknown>>();
  const updateFileRow = jest.fn<(args: unknown) => Promise<unknown>>();
  const mockPrisma = {
    importSession: {
      create: createSessionRow,
      findUnique: findSessionRow,
      update: updateSessionRow,
    },
    importFile: { findFirst: findFileRow, update: updateFileRow },
  };

  const mockStorage = {
    createMultipartUpload: jest.fn<StorageService['createMultipartUpload']>(),
    presignPutObject: jest.fn<StorageService['presignPutObject']>(),
    presignUploadPart: jest.fn<StorageService['presignUploadPart']>(),
    abortMultipartUpload: jest.fn<StorageService['abortMultipartUpload']>(),
    completeMultipartUpload:
      jest.fn<StorageService['completeMultipartUpload']>(),
    headObject: jest.fn<StorageService['headObject']>(),
    deletePrefix: jest.fn<StorageService['deletePrefix']>(),
    deleteObjectQuietly: jest.fn<StorageService['deleteObjectQuietly']>(),
  };

  const fileRow = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    id: 'file-1',
    sessionId: 'sess-1',
    originalName: 'a.flac',
    size: 100,
    objectKey: 'sess-1/file-1',
    uploadId: 'up-1',
    partCount: 1,
    uploadedAt: null,
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    ...overrides,
  });

  const mockQueue = {
    add: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    remove: jest.fn<(...a: unknown[]) => Promise<number>>(),
  };

  const build = (
    config: Record<string, string | undefined> = {},
  ): UploadSessionsService =>
    new UploadSessionsService(
      mockPrisma as unknown as PrismaService,
      mockStorage as unknown as StorageService,
      mockQueue as unknown as Queue,
      { get: (key: string) => config[key] } as unknown as ConfigService,
    );

  const file = (overrides: Partial<UploadFileInput> = {}): UploadFileInput => ({
    name: 'song.flac',
    size: 50,
    contentType: 'audio/flac',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    createSessionRow.mockResolvedValue(undefined);
    mockStorage.createMultipartUpload.mockImplementation((_bucket, key) =>
      Promise.resolve(`upload-${key}`),
    );
    mockStorage.presignPutObject.mockResolvedValue('https://put-url');
    mockStorage.presignUploadPart.mockImplementation(
      (_bucket, _key, _uploadId, partNumber) =>
        Promise.resolve(`https://part-${partNumber}`),
    );
    mockStorage.abortMultipartUpload.mockResolvedValue(undefined);
    mockStorage.completeMultipartUpload.mockResolvedValue(undefined);
    mockStorage.headObject.mockResolvedValue({ contentLength: 0 });
    mockStorage.deletePrefix.mockResolvedValue(undefined);
    mockStorage.deleteObjectQuietly.mockResolvedValue(undefined);
    findFileRow.mockResolvedValue(null);
    findSessionRow.mockResolvedValue(null);
    updateFileRow.mockImplementation((args) =>
      Promise.resolve(
        fileRow({ ...(args as { data: object }).data, uploadedAt: new Date() }),
      ),
    );
    updateSessionRow.mockResolvedValue(undefined);
    mockQueue.add.mockResolvedValue(undefined);
    mockQueue.remove.mockResolvedValue(1);
  });

  describe('createSession', () => {
    it('issues a single presigned PUT for a file that fits one part', async () => {
      const service = build({ UPLOAD_PART_SIZE_BYTES: '100' });

      const res = await service.createSession([file({ size: 100 })], 'admin-1');

      expect(res.files).toHaveLength(1);
      const target = res.files[0];
      expect(target.mode).toBe('single');
      expect(target.url).toBe('https://put-url');
      expect(target.parts).toBeUndefined();
      expect(target.uploadId).toBeUndefined();
      expect(mockStorage.createMultipartUpload).not.toHaveBeenCalled();
      expect(res.partSize).toBe(100);
    });

    it('splits a larger file into ceil(size / partSize) multipart parts', async () => {
      const service = build({ UPLOAD_PART_SIZE_BYTES: '100' });

      const res = await service.createSession([file({ size: 250 })], 'admin-1');

      const target = res.files[0];
      expect(target.mode).toBe('multipart');
      expect(target.uploadId).toBe(`upload-${res.sessionId}/${target.fileId}`);
      expect(target.parts?.map((p) => p.partNumber)).toEqual([1, 2, 3]);
      expect(target.parts?.map((p) => p.url)).toEqual([
        'https://part-1',
        'https://part-2',
        'https://part-3',
      ]);
      expect(target.url).toBeUndefined();
      expect(mockStorage.presignUploadPart).toHaveBeenCalledTimes(3);
    });

    it('persists the session and files with staging keys and part metadata', async () => {
      const service = build({ UPLOAD_PART_SIZE_BYTES: '100' });

      const res = await service.createSession(
        [file({ size: 250 }), file({ name: 'b.flac', size: 40 })],
        'admin-42',
      );

      expect(createSessionRow).toHaveBeenCalledTimes(1);
      const { data } = createSessionRow.mock.calls[0][0] as CreateArgs;
      expect(data).toMatchObject({
        id: res.sessionId,
        createdBy: 'admin-42',
        partSize: 100,
        progressTotal: 2,
      });

      const [multipart, single] = data.files.create;
      expect(multipart).toMatchObject({
        objectKey: `${res.sessionId}/${multipart.id}`,
        uploadId: `upload-${res.sessionId}/${multipart.id}`,
        partCount: 3,
      });
      expect(single).toMatchObject({
        objectKey: `${res.sessionId}/${single.id}`,
        uploadId: null,
        partCount: null,
      });
    });

    it('derives the expiry from the configured presign TTL', async () => {
      const service = build({ UPLOAD_PRESIGN_TTL_SECONDS: '3600' });

      const before = Date.now();
      const res = await service.createSession([file()], 'admin-1');
      const ttlMs = res.expiresAt.getTime() - before;

      expect(ttlMs).toBeGreaterThan(3_500_000);
      expect(ttlMs).toBeLessThanOrEqual(3_600_000 + 1000);
    });

    it('aborts multipart uploads opened before a DB failure', async () => {
      const service = build({ UPLOAD_PART_SIZE_BYTES: '100' });
      createSessionRow.mockRejectedValue(new Error('db down'));

      await expect(
        service.createSession([file({ size: 250 })], 'admin-1'),
      ).rejects.toThrow('db down');

      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledWith(
        StorageBucket.Staging,
        expect.stringContaining('/'),
        expect.stringMatching(/^upload-/),
      );
    });

    it('has nothing to abort when every file is a single PUT', async () => {
      const service = build({ UPLOAD_PART_SIZE_BYTES: '100' });
      createSessionRow.mockRejectedValue(new Error('db down'));

      await expect(
        service.createSession([file({ size: 40 })], 'admin-1'),
      ).rejects.toThrow('db down');

      expect(mockStorage.abortMultipartUpload).not.toHaveBeenCalled();
    });
  });

  describe('completeFile', () => {
    it('completes a multipart file (normalizing etags), verifies size, and marks it uploaded', async () => {
      const service = build();
      findFileRow.mockResolvedValue(fileRow({ uploadId: 'up-1', size: 100 }));
      mockStorage.headObject.mockResolvedValue({ contentLength: 100 });

      const status = await service.completeFile('sess-1', 'file-1', [
        { partNumber: 2, etag: 'etag2' },
        { partNumber: 1, etag: '"etag1"' },
      ]);

      expect(mockStorage.completeMultipartUpload).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/file-1',
        'up-1',
        [
          { partNumber: 2, etag: '"etag2"' },
          { partNumber: 1, etag: '"etag1"' },
        ],
      );
      const updateArg = updateFileRow.mock.calls[0][0] as {
        where: { id: string };
        data: { uploadedAt: unknown };
      };
      expect(updateArg.where).toEqual({ id: 'file-1' });
      expect(updateArg.data.uploadedAt).toBeInstanceOf(Date);
      expect(status.uploadedAt).not.toBeNull();
    });

    it('verifies a single-PUT file without completing a multipart upload', async () => {
      const service = build();
      findFileRow.mockResolvedValue(fileRow({ uploadId: null, size: 50 }));
      mockStorage.headObject.mockResolvedValue({ contentLength: 50 });

      await service.completeFile('sess-1', 'file-1', []);

      expect(mockStorage.completeMultipartUpload).not.toHaveBeenCalled();
      expect(updateFileRow).toHaveBeenCalled();
    });

    it('rejects and deletes the object when the stored size mismatches', async () => {
      const service = build();
      findFileRow.mockResolvedValue(fileRow({ uploadId: null, size: 100 }));
      mockStorage.headObject.mockResolvedValue({ contentLength: 99 });

      await expect(
        service.completeFile('sess-1', 'file-1', []),
      ).rejects.toThrow('does not match');

      expect(mockStorage.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/file-1',
        expect.any(String),
      );
      expect(updateFileRow).not.toHaveBeenCalled();
    });

    it('is idempotent when the file is already uploaded', async () => {
      const service = build();
      findFileRow.mockResolvedValue(
        fileRow({ uploadedAt: new Date('2026-07-23T01:00:00.000Z') }),
      );

      const status = await service.completeFile('sess-1', 'file-1', []);

      expect(status.uploadedAt).toEqual(new Date('2026-07-23T01:00:00.000Z'));
      expect(mockStorage.completeMultipartUpload).not.toHaveBeenCalled();
      expect(mockStorage.headObject).not.toHaveBeenCalled();
      expect(updateFileRow).not.toHaveBeenCalled();
    });

    it('requires at least one part for a multipart file', async () => {
      const service = build();
      findFileRow.mockResolvedValue(fileRow({ uploadId: 'up-1' }));

      await expect(
        service.completeFile('sess-1', 'file-1', []),
      ).rejects.toThrow('at least one completed part');
      expect(mockStorage.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('404s when the file does not exist', async () => {
      const service = build();
      findFileRow.mockResolvedValue(null);

      await expect(
        service.completeFile('sess-1', 'missing', []),
      ).rejects.toThrow('Upload file not found');
    });
  });

  describe('getStatus', () => {
    it('returns status, progress, and files', async () => {
      const service = build();
      findSessionRow.mockResolvedValue({
        id: 'sess-1',
        status: 'PENDING_UPLOAD',
        phase: null,
        progressCurrent: 0,
        progressTotal: 2,
        error: null,
        albumId: null,
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
        finishedAt: null,
        files: [
          fileRow({
            id: 'file-1',
            originalName: 'a.flac',
            size: 100,
            uploadedAt: null,
          }),
          fileRow({
            id: 'file-2',
            originalName: 'b.flac',
            size: 40,
            uploadedAt: new Date('2026-07-23T02:00:00.000Z'),
          }),
        ],
      });

      const status = await service.getStatus('sess-1');

      expect(status).toMatchObject({
        sessionId: 'sess-1',
        status: 'PENDING_UPLOAD',
        phase: null,
        progress: { current: 0, total: 2 },
        albumId: null,
      });
      expect(status.files).toEqual([
        { fileId: 'file-1', name: 'a.flac', size: 100, uploadedAt: null },
        {
          fileId: 'file-2',
          name: 'b.flac',
          size: 40,
          uploadedAt: new Date('2026-07-23T02:00:00.000Z'),
        },
      ]);
    });

    it('404s for an unknown session', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(null);

      await expect(service.getStatus('missing')).rejects.toThrow(
        'Upload session not found',
      );
    });
  });

  describe('abortSession', () => {
    it('aborts in-progress multipart uploads, clears staging, and marks ABORTED', async () => {
      const service = build();
      findSessionRow.mockResolvedValue({
        id: 'sess-1',
        status: 'PENDING_UPLOAD',
        files: [
          fileRow({
            objectKey: 'sess-1/f1',
            uploadId: 'up-1',
            uploadedAt: null,
          }),
          fileRow({ objectKey: 'sess-1/f2', uploadId: null, uploadedAt: null }),
          fileRow({
            objectKey: 'sess-1/f3',
            uploadId: 'up-3',
            uploadedAt: new Date(),
          }),
        ],
      });

      await service.abortSession('sess-1');

      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledTimes(1);
      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/f1',
        'up-1',
      );
      expect(mockStorage.deletePrefix).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/',
      );
      const updateArg = updateSessionRow.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string; finishedAt: unknown };
      };
      expect(updateArg.where).toEqual({ id: 'sess-1' });
      expect(updateArg.data.status).toBe('ABORTED');
      expect(updateArg.data.finishedAt).toBeInstanceOf(Date);
    });

    it('409s when the session is already processing', async () => {
      const service = build();
      findSessionRow.mockResolvedValue({
        id: 'sess-1',
        status: 'PROCESSING',
        files: [],
      });

      await expect(service.abortSession('sess-1')).rejects.toThrow(
        'Cannot abort',
      );
      expect(updateSessionRow).not.toHaveBeenCalled();
    });

    it('404s for an unknown session', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(null);

      await expect(service.abortSession('missing')).rejects.toThrow(
        'Upload session not found',
      );
    });

    it('removes the queued job when aborting a QUEUED session', async () => {
      const service = build();
      findSessionRow.mockResolvedValue({
        id: 'sess-1',
        status: 'QUEUED',
        files: [],
      });

      await service.abortSession('sess-1');

      expect(mockQueue.remove).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('finalizeSession', () => {
    const uploadedSession = (over: Record<string, unknown> = {}) => ({
      id: 'sess-1',
      status: 'PENDING_UPLOAD',
      files: [fileRow({ uploadedAt: new Date() })],
      ...over,
    });

    it('queues a fully-uploaded session and enqueues a job', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(uploadedSession());

      await service.finalizeSession('sess-1');

      const updateArg = updateSessionRow.mock.calls[0][0] as {
        data: { status: string; queuedAt: unknown };
      };
      expect(updateArg.data.status).toBe('QUEUED');
      expect(updateArg.data.queuedAt).toBeInstanceOf(Date);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'ingest-album',
        { sessionId: 'sess-1' },
        expect.objectContaining({ jobId: 'sess-1', attempts: 3 }),
      );
    });

    it('409s when some files are not uploaded', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(
        uploadedSession({ files: [fileRow({ uploadedAt: null })] }),
      );

      await expect(service.finalizeSession('sess-1')).rejects.toThrow(
        'not finished uploading',
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('is idempotent when the session is already QUEUED', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(uploadedSession({ status: 'QUEUED' }));

      await service.finalizeSession('sess-1');

      expect(updateSessionRow).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('409s for a FAILED session', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(uploadedSession({ status: 'FAILED' }));

      await expect(service.finalizeSession('sess-1')).rejects.toThrow(
        'Cannot finalize',
      );
    });

    it('rolls the status back and 503s when enqueue fails', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(uploadedSession());
      mockQueue.add.mockRejectedValue(new Error('redis down'));

      await expect(service.finalizeSession('sess-1')).rejects.toThrow(
        'Failed to enqueue',
      );

      const rollback = updateSessionRow.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data.status ===
          'PENDING_UPLOAD',
      );
      expect(rollback).toBeDefined();
    });

    it('404s for an unknown session', async () => {
      const service = build();
      findSessionRow.mockResolvedValue(null);

      await expect(service.finalizeSession('missing')).rejects.toThrow(
        'Upload session not found',
      );
    });
  });

  describe('configuration', () => {
    it('defaults the part size when unset', async () => {
      const service = build();

      const res = await service.createSession([file()], 'admin-1');

      expect(res.partSize).toBe(64 * 1024 * 1024);
    });

    it.each(['abc', '0', '-5', '2.5'])(
      'rejects an invalid UPLOAD_PART_SIZE_BYTES (%s)',
      (bad) => {
        expect(() => build({ UPLOAD_PART_SIZE_BYTES: bad })).toThrow(
          'Invalid UPLOAD_PART_SIZE_BYTES',
        );
      },
    );
  });
});
