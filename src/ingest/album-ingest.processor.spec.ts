import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import { Readable } from 'stream';
import type { IAudioMetadata, IPicture } from 'music-metadata';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { IngestService } from './ingest.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import type { AlbumImportPlan, TrackImportPlan } from './ingest.types.js';

const parseStream = jest.fn<(...args: unknown[]) => Promise<IAudioMetadata>>();
jest.unstable_mockModule('music-metadata', () => ({ parseStream }));

const { AlbumIngestProcessor } = await import('./album-ingest.processor.js');

const cover: IPicture = { format: 'image/jpeg', data: Buffer.from('cover') };

function buildMetadata(): IAudioMetadata {
  return {
    common: {
      title: 'Song',
      artists: ['Album Artist'],
      albumartists: ['Album Artist'],
      album: 'The Album',
      track: { no: 1, of: 1 },
      disk: { no: 1, of: 1 },
      date: '2021-05-01',
      genre: ['Rock'],
      picture: [cover],
    },
    format: {
      duration: 200,
      sampleRate: 44100,
      bitsPerSample: 16,
      bitrate: 900_000,
    },
  } as unknown as IAudioMetadata;
}

function trackPlan(overrides: Partial<TrackImportPlan> = {}): TrackImportPlan {
  return {
    tags: buildMetadata().common as unknown as TrackImportPlan['tags'],
    suffix: 'flac',
    size: 100,
    fileKey: 'sess-1/1-01.flac',
    trackArtistIds: ['artist-1'],
    ...overrides,
  };
}

function buildPlan(tracks: TrackImportPlan[]): AlbumImportPlan {
  return {
    albumId: 'sess-1',
    identityKey: 'id-key',
    albumTitle: 'The Album',
    releaseDate: new Date('2021-05-01'),
    albumArtistIds: ['artist-1'],
    coverKey: 'sess-1/cover.jpg',
    cover,
    tracks,
  };
}

type IngestJob = Job<{ sessionId: string }>;

const makeJob = (over: Partial<IngestJob> = {}): IngestJob =>
  ({
    data: { sessionId: 'sess-1' },
    isFailed: () => Promise.resolve(true),
    failedReason: 'boom',
    ...over,
  }) as unknown as IngestJob;

describe('AlbumIngestProcessor', () => {
  const prisma = {
    importSession: {
      updateMany: jest.fn<(...a: unknown[]) => Promise<{ count: number }>>(),
      update: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    },
    importFile: {
      findMany: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    },
    album: {
      findUnique: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    },
  };
  const storage = {
    getObjectStream:
      jest.fn<(...a: unknown[]) => Promise<{ stream: Readable }>>(),
    copyObject: jest.fn<(...a: unknown[]) => Promise<void>>(),
    deletePrefix: jest.fn<(...a: unknown[]) => Promise<void>>(),
  };
  const ingest = {
    planAlbum: jest.fn<(...a: unknown[]) => Promise<AlbumImportPlan>>(),
    persistImport: jest.fn<(...a: unknown[]) => Promise<void>>(),
    cleanupObjects: jest.fn<(...a: unknown[]) => Promise<void>>(),
  };
  const albums = { uploadCover: jest.fn<(...a: unknown[]) => Promise<void>>() };

  const processor = new AlbumIngestProcessor(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    ingest as unknown as IngestService,
    albums as unknown as AlbumsService,
  );

  const statuses = (): unknown[] =>
    prisma.importSession.update.mock.calls
      .map((call) => (call[0] as { data: { status?: string } }).data.status)
      .filter((status) => status !== undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.importSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.importSession.update.mockResolvedValue(undefined);
    prisma.importSession.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    prisma.importFile.findMany.mockResolvedValue([
      { objectKey: 'sess-1/f1', contentType: 'audio/flac', size: 100 },
    ]);
    prisma.album.findUnique.mockResolvedValue(null);
    storage.getObjectStream.mockImplementation(() =>
      Promise.resolve({ stream: Readable.from(Buffer.from('audio')) }),
    );
    storage.copyObject.mockResolvedValue(undefined);
    storage.deletePrefix.mockResolvedValue(undefined);
    ingest.planAlbum.mockResolvedValue(buildPlan([trackPlan()]));
    ingest.persistImport.mockResolvedValue(undefined);
    ingest.cleanupObjects.mockResolvedValue(undefined);
    albums.uploadCover.mockResolvedValue(undefined);
    parseStream.mockResolvedValue(buildMetadata());
  });

  describe('process', () => {
    it('parses, copies, persists, cleans staging, and completes', async () => {
      await processor.process(makeJob());

      expect(albums.uploadCover).toHaveBeenCalledWith(
        'sess-1/cover.jpg',
        cover,
      );
      expect(storage.copyObject).toHaveBeenCalledWith(
        'upload-staging',
        'sess-1/f1',
        'tracks',
        'sess-1/1-01.flac',
        'audio/flac',
      );
      expect(ingest.persistImport).toHaveBeenCalledTimes(1);
      expect(storage.deletePrefix).toHaveBeenCalledWith(
        'upload-staging',
        'sess-1/',
      );
      // Status trail ends at COMPLETED.
      expect(statuses().at(-1)).toBe('COMPLETED');
      expect(ingest.cleanupObjects).not.toHaveBeenCalled();
    });

    it('no-ops when the session is not claimable (duplicate delivery)', async () => {
      prisma.importSession.updateMany.mockResolvedValue({ count: 0 });

      await processor.process(makeJob());

      expect(prisma.importFile.findMany).not.toHaveBeenCalled();
      expect(ingest.planAlbum).not.toHaveBeenCalled();
    });

    it('skips persistence when the album already exists (crash resume)', async () => {
      prisma.album.findUnique.mockResolvedValue({ id: 'sess-1' });

      await processor.process(makeJob());

      expect(ingest.persistImport).not.toHaveBeenCalled();
      expect(statuses().at(-1)).toBe('COMPLETED');
    });

    it('marks FAILED with structured error and is unrecoverable on validation failure', async () => {
      ingest.planAlbum.mockRejectedValue(
        new BadRequestException({
          message: 'missing artists',
          missingArtists: ['Nina'],
        }),
      );

      await expect(processor.process(makeJob())).rejects.toBeInstanceOf(
        UnrecoverableError,
      );

      const failCall = prisma.importSession.update.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data.status === 'FAILED',
      );
      expect(failCall).toBeDefined();
      expect(
        (failCall?.[0] as { data: { error: { missingArtists: string[] } } })
          .data.error.missingArtists,
      ).toEqual(['Nina']);
      expect(ingest.cleanupObjects).toHaveBeenCalled();
    });

    it('rolls back copied objects and retries on a transient failure', async () => {
      prisma.importFile.findMany.mockResolvedValue([
        { objectKey: 'sess-1/f1', contentType: 'audio/flac', size: 100 },
        { objectKey: 'sess-1/f2', contentType: 'audio/flac', size: 100 },
      ]);
      ingest.planAlbum.mockResolvedValue(
        buildPlan([
          trackPlan({ fileKey: 'sess-1/1-01.flac' }),
          trackPlan({ fileKey: 'sess-1/1-02.flac' }),
        ]),
      );
      storage.copyObject.mockImplementation((_b, _k, _db, dstKey) =>
        dstKey === 'sess-1/1-02.flac'
          ? Promise.reject(new Error('s3 down'))
          : Promise.resolve(),
      );

      await expect(processor.process(makeJob())).rejects.toThrow('s3 down');

      // Not unrecoverable — BullMQ should retry.
      await expect(processor.process(makeJob())).rejects.not.toBeInstanceOf(
        UnrecoverableError,
      );
      expect(ingest.cleanupObjects).toHaveBeenCalledWith(
        ['sess-1/1-01.flac'],
        'sess-1/cover.jpg',
      );
    });
  });

  describe('onFailed', () => {
    it('records FAILED once retries are exhausted', async () => {
      await processor.onFailed(makeJob());

      const failCall = prisma.importSession.update.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data.status === 'FAILED',
      );
      expect(failCall).toBeDefined();
    });

    it('does nothing while retries remain', async () => {
      await processor.onFailed(
        makeJob({ isFailed: () => Promise.resolve(false) }),
      );

      expect(prisma.importSession.update).not.toHaveBeenCalled();
    });

    it('leaves an already-FAILED session untouched (preserves structured error)', async () => {
      prisma.importSession.findUnique.mockResolvedValue({ status: 'FAILED' });

      await processor.onFailed(makeJob());

      expect(prisma.importSession.update).not.toHaveBeenCalled();
    });
  });
});
