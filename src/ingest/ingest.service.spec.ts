import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { IPicture } from 'music-metadata';
import { IngestService } from './ingest.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MetadataTags } from '../admin/admin.types.js';
import type { ParsedTrackInput } from './ingest.types.js';

const cover: IPicture = { format: 'image/jpeg', data: Buffer.from('cover') };

function tags(overrides: Partial<MetadataTags> = {}): MetadataTags {
  return {
    title: 'Song',
    albumTitle: 'The Album',
    albumArtistNames: ['Album Artist'],
    trackArtistNames: ['Album Artist'],
    trackNumber: 1,
    discNumber: 1,
    genres: ['Rock'],
    date: new Date('2021-05-01'),
    duration: 200,
    sampleRate: 44100,
    bitDepth: 16,
    bitRate: 900,
    picture: undefined,
    ...overrides,
  };
}

const input = (
  overrides: Partial<MetadataTags> = {},
  extra: Partial<ParsedTrackInput> = {},
): ParsedTrackInput => ({
  tags: tags(overrides),
  suffix: 'flac',
  size: 4242,
  ...extra,
});

describe('IngestService', () => {
  let ingestService: IngestService;

  const mockArtistService = {
    findIdsByNames:
      jest.fn<(names: string[]) => Promise<Map<string, string>>>(),
  };
  const mockAlbumService = {
    assertNotImported:
      jest.fn<(title: string, artistIds: string[]) => Promise<string>>(),
    buildCoverKey: jest.fn<(albumId: string) => string>(),
    create: jest.fn<() => Promise<void>>(),
    deleteCoverObject: jest.fn<(coverKey: string) => Promise<void>>(),
  };
  const mockTrackService = {
    buildFileKey:
      jest.fn<
        (albumId: string, tags: MetadataTags, suffix: string) => string
      >(),
    create: jest.fn<() => Promise<void>>(),
    deleteTrackObjects: jest.fn<(keys: string[]) => Promise<void>>(),
  };
  const mockPrisma = {
    $transaction:
      jest.fn<
        (
          fn: (tx: unknown) => Promise<unknown>,
          options?: unknown,
        ) => Promise<unknown>
      >(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockArtistService.findIdsByNames.mockResolvedValue(
      new Map([['Album Artist', 'album-artist-id']]),
    );
    mockAlbumService.assertNotImported.mockResolvedValue('identity-key');
    mockAlbumService.buildCoverKey.mockReturnValue('cover-key');
    mockAlbumService.create.mockResolvedValue(undefined);
    mockAlbumService.deleteCoverObject.mockResolvedValue(undefined);
    mockTrackService.buildFileKey.mockImplementation(
      (_albumId, t) => `file-${t.discNumber}-${t.trackNumber}`,
    );
    mockTrackService.create.mockResolvedValue(undefined);
    mockTrackService.deleteTrackObjects.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation((fn) => fn({}));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestService,
        { provide: TracksService, useValue: mockTrackService },
        { provide: ArtistsService, useValue: mockArtistService },
        { provide: AlbumsService, useValue: mockAlbumService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    ingestService = module.get(IngestService);
  });

  describe('planAlbum', () => {
    it('builds a plan with resolved keys, artists, and cover', async () => {
      const plan = await ingestService.planAlbum([input({ picture: cover })]);

      expect(plan).toMatchObject({
        identityKey: 'identity-key',
        albumTitle: 'The Album',
        albumArtistIds: ['album-artist-id'],
        coverKey: 'cover-key',
        cover,
      });
      expect(plan.tracks).toEqual([
        expect.objectContaining({
          fileKey: 'file-1-1',
          trackArtistIds: ['album-artist-id'],
          size: 4242,
        }),
      ]);
      expect(typeof plan.albumId).toBe('string');
    });

    it('uses the provided deterministic album id (idempotency anchor)', async () => {
      const plan = await ingestService.planAlbum([input()], {
        albumId: 'session-1',
      });

      expect(plan.albumId).toBe('session-1');
      expect(mockTrackService.buildFileKey).toHaveBeenCalledWith(
        'session-1',
        expect.anything(),
        'flac',
      );
    });

    it('leaves coverKey null when no image tag is present', async () => {
      const plan = await ingestService.planAlbum([input()]);

      expect(plan.coverKey).toBeNull();
      expect(plan.cover).toBeUndefined();
      expect(mockAlbumService.buildCoverKey).not.toHaveBeenCalled();
    });

    it('rejects when referenced artists do not exist yet', async () => {
      mockArtistService.findIdsByNames.mockResolvedValue(new Map());

      await expect(ingestService.planAlbum([input()])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects tracks that span multiple albums', async () => {
      mockArtistService.findIdsByNames.mockResolvedValue(
        new Map([
          ['Artist One', 'one'],
          ['Artist Two', 'two'],
        ]),
      );

      await expect(
        ingestService.planAlbum([
          input({
            albumTitle: 'One',
            albumArtistNames: ['Artist One'],
            trackArtistNames: ['Artist One'],
          }),
          input({
            albumTitle: 'Two',
            albumArtistNames: ['Artist Two'],
            trackArtistNames: ['Artist Two'],
            trackNumber: 2,
          }),
        ]),
      ).rejects.toThrow('Upload must contain tracks from a single album');
    });

    it('rejects duplicate disc/track positions', async () => {
      await expect(
        ingestService.planAlbum([
          input({ title: 'A', trackNumber: 1 }),
          input({ title: 'B', trackNumber: 1 }),
        ]),
      ).rejects.toThrow('Upload contains duplicate disc and track numbers');
    });
  });

  describe('persistImport', () => {
    it('creates the album and tracks in one extended-timeout transaction', async () => {
      const plan = await ingestService.planAlbum([input({ picture: cover })]);
      await ingestService.persistImport(plan);

      expect(mockAlbumService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'The Album',
          identityKey: 'identity-key',
          imageKey: 'cover-key',
        }),
        expect.anything(),
      );
      expect(mockTrackService.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileKey: 'file-1-1', size: 4242 }),
        expect.anything(),
      );

      const options = mockPrisma.$transaction.mock.calls[0][1] as {
        timeout?: number;
        maxWait?: number;
      };
      expect(options.timeout).toBeGreaterThan(5_000);
      expect(options.maxWait).toBeGreaterThan(0);
      expect(mockTrackService.deleteTrackObjects).not.toHaveBeenCalled();
    });

    it('rolls back uploaded objects when the transaction fails', async () => {
      const plan = await ingestService.planAlbum([input({ picture: cover })]);
      mockTrackService.create.mockRejectedValue(new Error('insert failed'));

      await expect(ingestService.persistImport(plan)).rejects.toThrow(
        'insert failed',
      );
      expect(mockTrackService.deleteTrackObjects).toHaveBeenCalledWith([
        'file-1-1',
      ]);
      expect(mockAlbumService.deleteCoverObject).toHaveBeenCalledWith(
        'cover-key',
      );
    });
  });

  describe('cleanupObjects', () => {
    it('deletes track objects and the cover', async () => {
      await ingestService.cleanupObjects(['k1', 'k2'], 'cover-key');

      expect(mockTrackService.deleteTrackObjects).toHaveBeenCalledWith([
        'k1',
        'k2',
      ]);
      expect(mockAlbumService.deleteCoverObject).toHaveBeenCalledWith(
        'cover-key',
      );
    });

    it('skips cover deletion when there is no cover key', async () => {
      await ingestService.cleanupObjects(['k1'], null);

      expect(mockAlbumService.deleteCoverObject).not.toHaveBeenCalled();
    });
  });
});
