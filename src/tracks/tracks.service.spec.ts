import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TracksService } from './tracks.service.js';
import { TrackRow, TrackSummaryRow } from './tracks.types.js';
import { Prisma, Track as PrismaTrack } from '../generated/prisma/client.js';
import { StorageService } from '../storage/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { TrackEntity, TrackSummaryEntity } from './tracks.entity.js';
import { Readable } from 'stream';
import { StorageBucket } from '../storage/storage.types.js';

type TrackAnnotations = { trackAnnotations: { trackId: string }[] };

type TrackFindUniqueRow =
  (TrackRow & TrackAnnotations) | { fileKey: string | null } | null;

const userId = 'user-1';

const albumRef = { id: 'album-1', title: 'Test Album' };
const artistRef = { id: 'artist-1', name: 'Test Artist' };

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const track: PrismaTrack = {
  id: '1',
  title: 'track',
  genres: [],
  duration: 300,
  releaseDate,
  trackNumber: 1,
  discNumber: 1,
  size: 200,
  albumId: '1',
  fileKey: '',
  bitDepth: 16,
  bitRate: 982,
  sampleRate: 44100,
  suffix: 'flac',
  createdAt: releaseDate,
  updatedAt: releaseDate,
};

describe('TracksService', () => {
  let tracksService: TracksService;

  const mockPrismaService = {
    track: {
      findUnique: jest.fn<() => Promise<TrackFindUniqueRow>>(),
      findMany:
        jest.fn<() => Promise<(TrackSummaryRow & TrackAnnotations)[]>>(),
      create: jest.fn<(args: Prisma.TrackCreateArgs) => Promise<PrismaTrack>>(),
      delete: jest.fn<() => Promise<PrismaTrack>>(),
      update: jest.fn<(args: Prisma.TrackUpdateArgs) => Promise<PrismaTrack>>(),
    },
    trackAnnotation: {
      upsert: jest.fn<() => Promise<unknown>>(),
      deleteMany: jest.fn<() => Promise<{ count: number }>>(),
    },
  };

  const mockStorageService = {
    getObjectStream: jest.fn<StorageService['getObjectStream']>(),
    putObject: jest.fn<StorageService['putObject']>(),
    deleteObject: jest.fn<StorageService['deleteObject']>(),
  };

  const mockPlaylistService = {
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
});
