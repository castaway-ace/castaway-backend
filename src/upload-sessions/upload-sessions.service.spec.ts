import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { UploadSessionsService } from './upload-sessions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';
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
  const mockPrisma = { importSession: { create: createSessionRow } };

  const mockStorage = {
    createMultipartUpload: jest.fn<StorageService['createMultipartUpload']>(),
    presignPutObject: jest.fn<StorageService['presignPutObject']>(),
    presignUploadPart: jest.fn<StorageService['presignUploadPart']>(),
    abortMultipartUpload: jest.fn<StorageService['abortMultipartUpload']>(),
  };

  const build = (
    config: Record<string, string | undefined> = {},
  ): UploadSessionsService =>
    new UploadSessionsService(
      mockPrisma as unknown as PrismaService,
      mockStorage as unknown as StorageService,
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
