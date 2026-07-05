import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlaylistsService } from './playlists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { PlaylistType, Prisma } from '../generated/prisma/client.js';
import {
  PlaylistIdentity,
  PlaylistRow,
  PlaylistSummaryRow,
  PlaylistTrackRow,
} from './playlists.types.js';

const userId = 'user-1';

const playlistIdentity: PlaylistIdentity = {
  id: 'playlist-1',
  ownerId: userId,
  type: PlaylistType.USER,
};

const playlistRow: PlaylistRow = {
  id: 'playlist-1',
  name: 'Test Playlist',
  description: null,
  ownerId: userId,
  type: PlaylistType.USER,
  tracks: [
    { track: { albumId: 'album-1' } },
    { track: { albumId: 'album-1' } },
    { track: { albumId: 'album-2' } },
  ],
};

const playlistSummaryRow: PlaylistSummaryRow = {
  id: 'playlist-1',
  name: 'Test Playlist',
  type: PlaylistType.USER,
  tracks: [
    { track: { albumId: 'album-1' } },
    { track: { albumId: 'album-2' } },
  ],
};

const playlistTrackRow: PlaylistTrackRow = {
  id: 'pt-1',
  position: 3,
  track: {
    id: 'track-1',
    title: 'Test Track',
    genres: ['rock'],
    duration: 300,
    trackNumber: 1,
    discNumber: 1,
    album: { id: 'album-1', title: 'Test Album' },
    trackArtists: [{ artist: { id: 'artist-1', name: 'Test Artist' } }],
  },
};

describe('PlaylistsService', () => {
  let playlistsService: PlaylistsService;

  const mockPrismaService = {
    playlist: {
      findUnique:
        jest.fn<() => Promise<PlaylistRow | PlaylistIdentity | null>>(),
      findFirst:
        jest.fn<() => Promise<PlaylistRow | PlaylistIdentity | null>>(),
      findMany:
        jest.fn<
          (args: Prisma.PlaylistFindManyArgs) => Promise<PlaylistSummaryRow[]>
        >(),
      create:
        jest.fn<
          (
            args: Prisma.PlaylistCreateArgs,
          ) => Promise<{ id: string; name: string }>
        >(),
      updateMany:
        jest.fn<
          (args: Prisma.PlaylistUpdateManyArgs) => Promise<{ count: number }>
        >(),
      deleteMany:
        jest.fn<
          (args: Prisma.PlaylistDeleteManyArgs) => Promise<{ count: number }>
        >(),
    },
    playlistTrack: {
      findMany: jest.fn<() => Promise<PlaylistTrackRow[]>>(),
      findFirst:
        jest.fn<
          (
            args: Prisma.PlaylistTrackFindFirstArgs,
          ) => Promise<PlaylistTrackRow | { position: number } | null>
        >(),
      create:
        jest.fn<(args: Prisma.PlaylistTrackCreateArgs) => Promise<unknown>>(),
      delete:
        jest.fn<(args: Prisma.PlaylistTrackDeleteArgs) => Promise<unknown>>(),
    },
    track: {
      findUnique: jest.fn<() => Promise<{ id: string } | null>>(),
    },
  };

  const mockAlbumService = {
    findAlbumCoverMap: jest.fn<AlbumsService['findAlbumCoverMap']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAlbumService.findAlbumCoverMap.mockResolvedValue(
      new Map([['album-1', 'https://cdn/album-1.jpg']]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AlbumsService,
          useValue: mockAlbumService,
        },
      ],
    }).compile();

    playlistsService = module.get(PlaylistsService);
  });

  describe('findAll', () => {
    beforeEach(() => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        playlistSummaryRow,
      ]);
    });

    it('scopes to the owner with clamped pagination and an id tiebreaker', async () => {
      await playlistsService.findAll(userId, {});

      const [findManyArgs] = mockPrismaService.playlist.findMany.mock.calls[0];
      expect(findManyArgs).toMatchObject({
        where: { ownerId: userId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
      });
    });

    it('filters to user playlists when onlyUser is set', async () => {
      await playlistsService.findAll(userId, {
        filters: { onlyUser: true },
      });

      const [findManyArgs] = mockPrismaService.playlist.findMany.mock.calls[0];
      expect(findManyArgs).toMatchObject({
        where: { ownerId: userId, type: 'USER' },
      });
    });

    it('maps summaries with resolved covers, omitting albums without covers', async () => {
      const result = await playlistsService.findAll(userId, {});

      expect(result).toEqual([
        {
          id: 'playlist-1',
          name: 'Test Playlist',
          type: PlaylistType.USER,
          albumCoverUrls: ['https://cdn/album-1.jpg'],
        },
      ]);
      expect(mockAlbumService.findAlbumCoverMap).toHaveBeenCalledWith([
        'album-1',
        'album-2',
      ]);
    });
  });

  describe('find', () => {
    it('returns the enriched playlist for its owner', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(playlistRow);

      const result = await playlistsService.find(userId, 'playlist-1');

      expect(result).toEqual({
        id: 'playlist-1',
        name: 'Test Playlist',
        description: null,
        ownerId: userId,
        type: PlaylistType.USER,
        albumCoverUrls: ['https://cdn/album-1.jpg'],
      });
    });

    it('throws NotFoundException when the playlist does not exist', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(null);

      await expect(playlistsService.find(userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a playlist owned by another user without enriching', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue({
        ...playlistRow,
        ownerId: 'someone-else',
      });

      await expect(playlistsService.find(userId, 'playlist-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockAlbumService.findAlbumCoverMap).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a playlist and returns its reference', async () => {
      mockPrismaService.playlist.create.mockResolvedValue({
        id: 'playlist-9',
        name: 'New Mix',
      });

      const result = await playlistsService.create(userId, 'New Mix');

      expect(result).toEqual({ id: 'playlist-9', name: 'New Mix' });

      const [createArgs] = mockPrismaService.playlist.create.mock.calls[0];
      expect(createArgs).toMatchObject({
        data: { ownerId: userId, name: 'New Mix' },
        select: { id: true, name: true },
      });
    });
  });

  describe('update', () => {
    it('restricts the update to user playlists owned by the caller', async () => {
      mockPrismaService.playlist.updateMany.mockResolvedValue({ count: 1 });

      await playlistsService.update(userId, 'playlist-1', 'Renamed');

      const [updateArgs] = mockPrismaService.playlist.updateMany.mock.calls[0];
      expect(updateArgs).toMatchObject({
        where: {
          id: 'playlist-1',
          ownerId: userId,
          type: PlaylistType.USER,
        },
        data: { name: 'Renamed' },
      });
    });

    it('throws NotFoundException when nothing matches', async () => {
      mockPrismaService.playlist.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        playlistsService.update(userId, 'liked-1', 'Renamed'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('restricts the delete to user playlists owned by the caller', async () => {
      mockPrismaService.playlist.deleteMany.mockResolvedValue({ count: 1 });

      await playlistsService.delete(userId, 'playlist-1');

      const [deleteArgs] = mockPrismaService.playlist.deleteMany.mock.calls[0];
      expect(deleteArgs).toMatchObject({
        where: {
          id: 'playlist-1',
          ownerId: userId,
          type: PlaylistType.USER,
        },
      });
    });

    it('throws NotFoundException when nothing matches', async () => {
      mockPrismaService.playlist.deleteMany.mockResolvedValue({ count: 0 });

      await expect(playlistsService.delete(userId, 'liked-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addTrack', () => {
    beforeEach(() => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(playlistIdentity);
      mockPrismaService.track.findUnique.mockResolvedValue({ id: 'track-1' });
    });

    it('appends after the highest existing position', async () => {
      mockPrismaService.playlistTrack.findFirst.mockResolvedValue({
        position: 4,
      });

      await playlistsService.addTrack(userId, 'playlist-1', 'track-1');

      const [createArgs] = mockPrismaService.playlistTrack.create.mock.calls[0];
      expect(createArgs).toMatchObject({
        data: { playlistId: 'playlist-1', trackId: 'track-1', position: 5 },
      });
    });

    it('starts at position zero for an empty playlist', async () => {
      mockPrismaService.playlistTrack.findFirst.mockResolvedValue(null);

      await playlistsService.addTrack(userId, 'playlist-1', 'track-1');

      const [createArgs] = mockPrismaService.playlistTrack.create.mock.calls[0];
      expect(createArgs).toMatchObject({
        data: { position: 0 },
      });
    });

    it('throws NotFoundException for a playlist owned by another user', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue({
        ...playlistIdentity,
        ownerId: 'someone-else',
      });

      await expect(
        playlistsService.addTrack(userId, 'playlist-1', 'track-1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.playlistTrack.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the track does not exist', async () => {
      mockPrismaService.track.findUnique.mockResolvedValue(null);

      await expect(
        playlistsService.addTrack(userId, 'playlist-1', 'missing'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.playlistTrack.create).not.toHaveBeenCalled();
    });
  });

  describe('findTrack', () => {
    beforeEach(() => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(playlistIdentity);
    });

    it('selects the most recently added copy among duplicates', async () => {
      mockPrismaService.playlistTrack.findFirst.mockResolvedValue(
        playlistTrackRow,
      );

      await playlistsService.findTrack(userId, 'playlist-1', 'track-1');

      const [findFirstArgs] =
        mockPrismaService.playlistTrack.findFirst.mock.calls[0];
      expect(findFirstArgs).toMatchObject({
        where: { playlistId: 'playlist-1', trackId: 'track-1' },
        orderBy: { position: 'desc' },
      });
    });

    it('throws NotFoundException when the track is not in the playlist', async () => {
      mockPrismaService.playlistTrack.findFirst.mockResolvedValue(null);

      await expect(
        playlistsService.findTrack(userId, 'playlist-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTrack', () => {
    it('deletes the playlist track resolved by findTrack', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(playlistIdentity);
      mockPrismaService.playlistTrack.findFirst.mockResolvedValue(
        playlistTrackRow,
      );

      await playlistsService.deleteTrack(userId, 'playlist-1', 'track-1');

      const [deleteArgs] = mockPrismaService.playlistTrack.delete.mock.calls[0];
      expect(deleteArgs).toMatchObject({ where: { id: 'pt-1' } });
    });
  });

  describe('findTracks', () => {
    it('returns tracks ordered by position mapped to entities', async () => {
      mockPrismaService.playlist.findUnique.mockResolvedValue(playlistIdentity);
      mockPrismaService.playlistTrack.findMany.mockResolvedValue([
        playlistTrackRow,
      ]);

      const result = await playlistsService.findTracks(userId, 'playlist-1');

      expect(result).toEqual([
        {
          id: 'pt-1',
          trackId: 'track-1',
          title: 'Test Track',
          genres: ['rock'],
          duration: 300,
          trackNumber: 1,
          discNumber: 1,
          album: { id: 'album-1', title: 'Test Album' },
          artists: [{ id: 'artist-1', name: 'Test Artist' }],
        },
      ]);
    });
  });
});
