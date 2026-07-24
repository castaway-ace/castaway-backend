import { jest } from '@jest/globals';
import type { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { StagingSweeperService } from './staging-sweeper.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { StorageBucket } from '../storage/storage.types.js';

describe('StagingSweeperService', () => {
  const findMany = jest.fn<(...a: unknown[]) => Promise<unknown[]>>();
  const update = jest.fn<(...a: unknown[]) => Promise<unknown>>();
  const deleteMany = jest.fn<(...a: unknown[]) => Promise<{ count: number }>>();
  const prisma = { importSession: { findMany, update, deleteMany } };

  const storage = {
    abortMultipartUpload: jest.fn<(...a: unknown[]) => Promise<void>>(),
    deletePrefix: jest.fn<(...a: unknown[]) => Promise<void>>(),
  };
  const queue = {
    getJob: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    add: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
  };

  const build = (
    config: Record<string, string | undefined> = {},
  ): StagingSweeperService =>
    new StagingSweeperService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      queue as unknown as Queue,
      { get: (key: string) => config[key] } as unknown as ConfigService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    update.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue({ count: 0 });
    storage.abortMultipartUpload.mockResolvedValue(undefined);
    storage.deletePrefix.mockResolvedValue(undefined);
    queue.getJob.mockResolvedValue(undefined);
    queue.add.mockResolvedValue(undefined);
  });

  describe('expireAbandoned', () => {
    it('aborts incomplete multipart uploads, clears staging, and marks ABORTED', async () => {
      findMany.mockResolvedValue([
        {
          id: 'sess-1',
          files: [
            { objectKey: 'sess-1/a', uploadId: 'up-a', uploadedAt: null },
            { objectKey: 'sess-1/b', uploadId: null, uploadedAt: null },
            { objectKey: 'sess-1/c', uploadId: 'up-c', uploadedAt: new Date() },
          ],
        },
      ]);

      await build().expireAbandoned();

      expect(storage.abortMultipartUpload).toHaveBeenCalledTimes(1);
      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/a',
        'up-a',
      );
      expect(storage.deletePrefix).toHaveBeenCalledWith(
        StorageBucket.Staging,
        'sess-1/',
      );
      const arg = update.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string };
      };
      expect(arg.where.id).toBe('sess-1');
      expect(arg.data.status).toBe('ABORTED');
    });

    it('honors a custom UPLOAD_SESSION_TTL_HOURS', async () => {
      const before = Date.now();

      await build({ UPLOAD_SESSION_TTL_HOURS: '1' }).expireAbandoned();

      const where = (
        findMany.mock.calls[0][0] as { where: { createdAt: { lt: Date } } }
      ).where;
      const ageMs = before - where.createdAt.lt.getTime();
      expect(ageMs).toBeGreaterThan(59 * 60 * 1000);
      expect(ageMs).toBeLessThan(61 * 60 * 1000);
    });
  });

  describe('requeueOrphaned', () => {
    it('re-enqueues QUEUED sessions whose job has vanished', async () => {
      findMany.mockResolvedValue([{ id: 'sess-1' }, { id: 'sess-2' }]);
      queue.getJob.mockImplementation((id) =>
        Promise.resolve(id === 'sess-2' ? { id } : undefined),
      );

      await build().requeueOrphaned();

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'ingest-album',
        { sessionId: 'sess-1' },
        expect.objectContaining({ jobId: 'sess-1', attempts: 3 }),
      );
    });
  });

  describe('pruneTerminal', () => {
    it('deletes terminal sessions past the retention window', async () => {
      deleteMany.mockResolvedValue({ count: 3 });

      await build().pruneTerminal();

      const arg = deleteMany.mock.calls[0][0] as {
        where: { status: { in: string[] }; finishedAt: { lt: Date } };
      };
      expect(arg.where.status.in).toEqual(
        expect.arrayContaining(['COMPLETED', 'FAILED', 'ABORTED']),
      );
      expect(arg.where.finishedAt.lt).toBeInstanceOf(Date);
    });
  });

  describe('sweep', () => {
    it('runs all three passes', async () => {
      await build().sweep();

      expect(findMany).toHaveBeenCalledTimes(2);
      expect(deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration', () => {
    it.each(['abc', '0', '-1'])(
      'rejects an invalid UPLOAD_SESSION_TTL_HOURS (%s)',
      (bad) => {
        expect(() => build({ UPLOAD_SESSION_TTL_HOURS: bad })).toThrow(
          'Invalid UPLOAD_SESSION_TTL_HOURS',
        );
      },
    );
  });
});
