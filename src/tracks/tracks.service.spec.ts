import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TracksService } from './tracks.service.js';
import { TrackRow, TrackSummaryRow } from './tracks.types.js';
import { Prisma, Track as PrismaTrack } from '../generated/prisma/client.js';
import { StorageService } from '../storage/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { TrackEntity, TrackSummaryEntity } from './tracks.entity.js';
import { Readable } from 'stream';
import { StorageBucket } from '../storage/storage.types.js';
import { MetadataTags } from '../admin/admin.types.js';

type TrackAnnotations = { trackAnnotations: { trackId: string }[] };

type TrackFindUniqueRow =
  (TrackRow & TrackAnnotations) | { fileKey: string | null } | null;

const userId = 'user-1';

const albumRef = { id: 'album-1', title: 'Test Album' };
const artistRef = { id: 'artist-1', name: 'Test Artist' };

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

describe('TracksService', () => {
  let tracksService: TracksService;
  const mockTx = {
    track: {
      findUnique: jest.fn<() => Promise<{ id: string } | null>>(),
    },
    trackAnnotation: {
      findUnique: jest.fn<() => Promise<{ starred: boolean } | null>>(),
      upsert:
        jest.fn<(args: Prisma.TrackAnnotationUpsertArgs) => Promise<unknown>>(),
    },
  };

  const mockPrismaService = {
    track: {
      findUnique: jest.fn<() => Promise<TrackFindUniqueRow>>(),
      findMany:
        jest.fn<() => Promise<(TrackSummaryRow & TrackAnnotations)[]>>(),
      create: jest.fn<(args: Prisma.TrackCreateArgs) => Promise<PrismaTrack>>(),
      delete: jest.fn<() => Promise<PrismaTrack>>(),
      update: jest.fn<(args: Prisma.TrackUpdateArgs) => Promise<PrismaTrack>>(),
    },
    $transaction: jest.fn(
      async (
        callback: (tx: Prisma.TransactionClient) => Promise<void>,
      ): Promise<void> =>
        callback(mockTx as unknown as Prisma.TransactionClient),
    ),
  };

  const mockStorageService = {
    getObjectStream: jest.fn<StorageService['getObjectStream']>(),
    putObject: jest.fn<StorageService['putObject']>(),
    deleteObjectQuietly: jest.fn<StorageService['deleteObjectQuietly']>(),
  };

  const mockPlaylistService = {
    findLikedRecord: jest.fn<() => Promise<{ id: string }>>(),
    addTrack: jest.fn<PlaylistsService['addTrack']>(),
    deleteTrack: jest.fn<PlaylistsService['deleteTrack']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: PlaylistsService,
          useValue: mockPlaylistService,
        },
      ],
    }).compile();

    tracksService = module.get(TracksService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    const trackSummaryRows: (TrackSummaryRow & TrackAnnotations)[] = [
      {
        id: 'track-1',
        title: 'test1',
        releaseDate,
        genres: ['rock'],
        trackArtists: [{ artist: artistRef }],
        trackNumber: 1,
        duration: 300,
        album: albumRef,
        trackAnnotations: [],
      },
    ];

    const trackSummaryEntities: TrackSummaryEntity[] = [
      {
        id: 'track-1',
        title: 'test1',
        releaseDate,
        genres: ['rock'],
        trackNumber: 1,
        album: albumRef,
        duration: 300,
        artists: [artistRef],
        starred: false,
      },
    ];

    it('should find all tracks', async () => {
      mockPrismaService.track.findMany.mockResolvedValue(trackSummaryRows);
      const result = await tracksService.findAll(userId, {});
      expect(result).toEqual(trackSummaryEntities);
    });
  });

  describe('find', () => {
    const trackRow: TrackRow & TrackAnnotations = {
      id: '1',
      title: 'track',
      genres: [],
      duration: 300,
      releaseDate,
      trackNumber: 1,
      discNumber: 1,
      size: 200,
      album: albumRef,
      trackArtists: [
        {
          artist: artistRef,
        },
      ],
      trackAnnotations: [],
    };

    const trackEntity: TrackEntity = {
      id: '1',
      title: 'track',
      genres: [],
      duration: 300,
      releaseDate,
      trackNumber: 1,
      discNumber: 1,
      size: 200,
      album: albumRef,
      artists: [artistRef],
      starred: false,
    };

    it('should find a track by id', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue(trackRow);
      const result = await tracksService.find(userId, 'track-1');
      expect(result).toEqual(trackEntity);
    });

    it('throws NotFoundException when the track does not exist', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue(null);
      await expect(tracksService.find(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTrackStream', () => {
    const trackStream = {
      stream: Readable.from(Buffer.from('audio file')),
      contentType: 'audio/flac',
      contentLength: 10,
    };

    it('should get the track stream', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue({
        fileKey: 'track-1/song.flac',
      });
      mockStorageService.getObjectStream.mockResolvedValue(trackStream);
      const result = await tracksService.getTrackStream('track-1');
      expect(result).toEqual(trackStream);
      expect(mockStorageService.getObjectStream).toHaveBeenCalledWith(
        StorageBucket.Tracks,
        'track-1/song.flac',
        undefined,
      );
    });
  });

  describe('setStarred', () => {
    const trackId = 'track-1';
    const likedPlaylist = { id: 'liked-1' };

    beforeEach(() => {
      mockTx.track.findUnique.mockResolvedValue({ id: trackId });
      mockPlaylistService.findLikedRecord.mockResolvedValue(likedPlaylist);
    });

    it('stars an unstarred track and adds it to the Liked playlist', async () => {
      mockTx.trackAnnotation.findUnique.mockResolvedValue(null);

      await tracksService.setStarred(userId, trackId, true);

      const [upsertArgs] = mockTx.trackAnnotation.upsert.mock.calls[0];
      expect(upsertArgs).toMatchObject({
        where: { userId_trackId: { userId, trackId } },
        create: { userId, trackId, starred: true },
        update: { starred: true },
      });
      expect(upsertArgs.create.starredAt).toBeInstanceOf(Date);
      expect(upsertArgs.update.starredAt).toBeInstanceOf(Date);

      expect(mockPlaylistService.addTrack).toHaveBeenCalledWith(
        userId,
        likedPlaylist.id,
        trackId,
        mockTx,
      );
      expect(mockPlaylistService.deleteTrack).not.toHaveBeenCalled();
    });

    it('unstars a starred track and removes it from the Liked playlist', async () => {
      mockTx.trackAnnotation.findUnique.mockResolvedValue({ starred: true });

      await tracksService.setStarred(userId, trackId, false);

      const [upsertArgs] = mockTx.trackAnnotation.upsert.mock.calls[0];
      expect(upsertArgs).toMatchObject({
        where: { userId_trackId: { userId, trackId } },
        update: { starred: false, starredAt: null },
      });

      expect(mockPlaylistService.deleteTrack).toHaveBeenCalledWith(
        userId,
        likedPlaylist.id,
        trackId,
        mockTx,
      );
      expect(mockPlaylistService.addTrack).not.toHaveBeenCalled();
    });

    it('is a no-op when starring an already starred track', async () => {
      mockTx.trackAnnotation.findUnique.mockResolvedValue({ starred: true });

      await tracksService.setStarred(userId, trackId, true);

      expect(mockTx.trackAnnotation.upsert).not.toHaveBeenCalled();
      expect(mockPlaylistService.addTrack).not.toHaveBeenCalled();
      expect(mockPlaylistService.findLikedRecord).not.toHaveBeenCalled();
    });

    it('is a no-op when unstarring a track that was never starred', async () => {
      mockTx.trackAnnotation.findUnique.mockResolvedValue(null);

      await tracksService.setStarred(userId, trackId, false);

      expect(mockTx.trackAnnotation.upsert).not.toHaveBeenCalled();
      expect(mockPlaylistService.deleteTrack).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the track does not exist', async () => {
      mockTx.track.findUnique.mockResolvedValue(null);

      await expect(
        tracksService.setStarred(userId, 'missing', true),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.trackAnnotation.upsert).not.toHaveBeenCalled();
      expect(mockPlaylistService.addTrack).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the row before the audio object via the quiet helper', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue({
        fileKey: 'album-1/1-01.flac',
      });
      mockPrismaService.track.delete.mockResolvedValue({} as PrismaTrack);

      await tracksService.delete('track-1');

      expect(mockPrismaService.track.delete).toHaveBeenCalledWith({
        where: { id: 'track-1' },
      });
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.Tracks,
        'album-1/1-01.flac',
        expect.any(String),
      );

      const rowOrder =
        mockPrismaService.track.delete.mock.invocationCallOrder[0];
      const objectOrder =
        mockStorageService.deleteObjectQuietly.mock.invocationCallOrder[0];
      expect(rowOrder).toBeLessThan(objectOrder);
    });

    it('throws NotFoundException and skips storage when the track is missing', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue(null);

      await expect(tracksService.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.track.delete).not.toHaveBeenCalled();
      expect(mockStorageService.deleteObjectQuietly).not.toHaveBeenCalled();
    });
  });

  describe('deleteTrackObjects', () => {
    it('deletes every key via the quiet helper', async () => {
      await tracksService.deleteTrackObjects(['a', 'b']);

      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledTimes(2);
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.Tracks,
        'a',
        expect.any(String),
      );
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.Tracks,
        'b',
        expect.any(String),
      );
    });

    it('does nothing for an empty list', async () => {
      await tracksService.deleteTrackObjects([]);
      expect(mockStorageService.deleteObjectQuietly).not.toHaveBeenCalled();
    });
  });

  describe('deleteAlbumTrackFiles', () => {
    it('deletes the audio object for every track on the album', async () => {
      mockPrismaService.track.findMany.mockResolvedValue([
        { fileKey: 'album-1/1-01.flac' },
        { fileKey: 'album-1/1-02.flac' },
      ] as unknown as (TrackSummaryRow & TrackAnnotations)[]);

      await tracksService.deleteAlbumTrackFiles('album-1');

      expect(mockPrismaService.track.findMany).toHaveBeenCalledWith({
        where: { albumId: 'album-1' },
        select: { fileKey: true },
      });
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildFileKey', () => {
    it('zero-pads the track number and includes disc and suffix', () => {
      const tags = { discNumber: 1, trackNumber: 5 } as MetadataTags;
      expect(tracksService.buildFileKey('album-1', tags, 'flac')).toBe(
        'album-1/1-05.flac',
      );
    });
  });
});
