import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LibraryService } from './library.service.js';
import { LibraryItemType } from './library.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';

type PlaylistRow = {
  id: string;
  name: string;
  playlistInteractions: { updatedAt: Date }[];
};

type AlbumRow = {
  id: string;
  title: string;
  albumArtists: { artist: { id: string; name: string } }[];
  albumInteractions: { updatedAt: Date }[];
};

type ArtistRow = {
  id: string;
  name: string;
  artistInteractions: { updatedAt: Date }[];
};

const userId = 'user-1';
const artistRef = { id: 'artist-1', name: 'Test Artist' };

const at = (iso: string) => [{ updatedAt: new Date(iso) }];

describe('LibraryService', () => {
  let libraryService: LibraryService;

  const mockPrismaService = {
    playlist: { findMany: jest.fn<() => Promise<PlaylistRow[]>>() },
    album: { findMany: jest.fn<() => Promise<AlbumRow[]>>() },
    artist: { findMany: jest.fn<() => Promise<ArtistRow[]>>() },
  };

  const mockPlaylistService = {
    findPlaylistCoverMap: jest.fn<PlaylistsService['findPlaylistCoverMap']>(),
  };

  const mockArtistService = {
    findArtistImageMap: jest.fn<ArtistsService['findArtistImageMap']>(),
  };

  const mockAlbumService = {
    findAlbumCoverMap: jest.fn<AlbumsService['findAlbumCoverMap']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.playlist.findMany.mockResolvedValue([]);
    mockPrismaService.album.findMany.mockResolvedValue([]);
    mockPrismaService.artist.findMany.mockResolvedValue([]);
    mockPlaylistService.findPlaylistCoverMap.mockResolvedValue(new Map());
    mockArtistService.findArtistImageMap.mockResolvedValue(new Map());
    mockAlbumService.findAlbumCoverMap.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PlaylistsService, useValue: mockPlaylistService },
        { provide: ArtistsService, useValue: mockArtistService },
        { provide: AlbumsService, useValue: mockAlbumService },
      ],
    }).compile();

    libraryService = module.get(LibraryService);
  });

  describe('findAll', () => {
    it('scopes playlists to the owner and albums/artists to starred', async () => {
      await libraryService.findAll(userId);

      expect(mockPrismaService.playlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: userId } }),
      );
      expect(mockPrismaService.album.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { albumAnnotations: { some: { userId, starred: true } } },
        }),
      );
      expect(mockPrismaService.artist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { artistAnnotations: { some: { userId, starred: true } } },
        }),
      );
    });

    it('merges all three types, most recently interacted with first', async () => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        {
          id: 'playlist-1',
          name: 'Test Playlist',
          playlistInteractions: at('2026-06-06T02:00:00.000Z'),
        },
      ]);
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'album-1',
          title: 'Test Album',
          albumArtists: [{ artist: artistRef }],
          albumInteractions: at('2026-06-06T01:00:00.000Z'),
        },
      ]);
      mockPrismaService.artist.findMany.mockResolvedValue([
        {
          id: 'artist-1',
          name: 'Test Artist',
          artistInteractions: at('2026-06-06T03:00:00.000Z'),
        },
      ]);

      const result = await libraryService.findAll(userId);

      expect(result.map((item) => item.type)).toEqual([
        LibraryItemType.ARTIST,
        LibraryItemType.PLAYLIST,
        LibraryItemType.ALBUM,
      ]);
    });

    it('ranks never-interacted items last, alphabetically across types', async () => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        { id: 'pl-z', name: 'Zeta Mix', playlistInteractions: [] },
        { id: 'pl-a', name: 'Alpha Mix', playlistInteractions: [] },
      ]);
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'al-b',
          title: 'Beta Album',
          albumArtists: [],
          albumInteractions: [],
        },
        {
          id: 'al-touched',
          title: 'Zzz Touched Album',
          albumArtists: [],
          albumInteractions: at('2026-06-06T01:00:00.000Z'),
        },
      ]);
      mockPrismaService.artist.findMany.mockResolvedValue([
        { id: 'ar-c', name: 'Charlie Artist', artistInteractions: [] },
      ]);

      const result = await libraryService.findAll(userId);

      expect(
        result.map((item) => {
          if (item.type === LibraryItemType.ALBUM) return item.album.title;
          if (item.type === LibraryItemType.ARTIST) return item.artist.name;
          return item.playlist.name;
        }),
      ).toEqual([
        // Interacted with, despite sorting last alphabetically.
        'Zzz Touched Album',
        'Alpha Mix',
        'Beta Album',
        'Charlie Artist',
        'Zeta Mix',
      ]);
    });

    it('reports a null lastInteractedAt for an untouched item', async () => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        { id: 'playlist-1', name: 'Untouched', playlistInteractions: [] },
      ]);

      const [item] = await libraryService.findAll(userId);

      expect(item).toMatchObject({
        type: LibraryItemType.PLAYLIST,
        playlist: { id: 'playlist-1', name: 'Untouched' },
        lastInteractedAt: null,
      });
    });

    it('resolves artwork for every type', async () => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        { id: 'playlist-1', name: 'Playlist One', playlistInteractions: [] },
      ]);
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'album-1',
          title: 'Album One',
          albumArtists: [{ artist: artistRef }],
          albumInteractions: [],
        },
      ]);
      mockPrismaService.artist.findMany.mockResolvedValue([
        { id: 'artist-1', name: 'Artist One', artistInteractions: [] },
      ]);
      mockAlbumService.findAlbumCoverMap.mockResolvedValue(
        new Map([['album-1', 'https://cdn/album-1.jpg']]),
      );
      mockArtistService.findArtistImageMap.mockResolvedValue(
        new Map([['artist-1', 'https://cdn/artist-1.jpg']]),
      );
      mockPlaylistService.findPlaylistCoverMap.mockResolvedValue(
        new Map([['playlist-1', ['https://cdn/cover-1.jpg']]]),
      );

      const result = await libraryService.findAll(userId);

      expect(result).toEqual([
        {
          type: LibraryItemType.ALBUM,
          album: { id: 'album-1', title: 'Album One' },
          artists: [artistRef],
          coverUrl: 'https://cdn/album-1.jpg',
          lastInteractedAt: null,
        },
        {
          type: LibraryItemType.ARTIST,
          artist: { id: 'artist-1', name: 'Artist One' },
          coverUrl: 'https://cdn/artist-1.jpg',
          lastInteractedAt: null,
        },
        {
          type: LibraryItemType.PLAYLIST,
          playlist: { id: 'playlist-1', name: 'Playlist One' },
          coverUrls: ['https://cdn/cover-1.jpg'],
          lastInteractedAt: null,
        },
      ]);
    });

    it('falls back to null artwork when none resolves', async () => {
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'album-1',
          title: 'Album One',
          albumArtists: [],
          albumInteractions: [],
        },
      ]);

      const [item] = await libraryService.findAll(userId);

      expect(item).toMatchObject({ coverUrl: null });
    });

    it('applies the pagination window after sorting, not per type', async () => {
      mockPrismaService.playlist.findMany.mockResolvedValue([
        {
          id: 'pl-1',
          name: 'Newest Playlist',
          playlistInteractions: at('2026-06-06T03:00:00.000Z'),
        },
      ]);
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'al-1',
          title: 'Middle Album',
          albumArtists: [],
          albumInteractions: at('2026-06-06T02:00:00.000Z'),
        },
      ]);
      mockPrismaService.artist.findMany.mockResolvedValue([
        {
          id: 'ar-1',
          name: 'Oldest Artist',
          artistInteractions: at('2026-06-06T01:00:00.000Z'),
        },
      ]);

      const result = await libraryService.findAll(userId, {
        pagination: { limit: 1, offset: 1 },
      });

      // The second item of the merged ranking, not the second of any one table.
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ album: { title: 'Middle Album' } });
    });

    it('only resolves artwork for the page it returns', async () => {
      mockPrismaService.album.findMany.mockResolvedValue([
        {
          id: 'al-newer',
          title: 'Newer',
          albumArtists: [],
          albumInteractions: at('2026-06-06T02:00:00.000Z'),
        },
        {
          id: 'al-older',
          title: 'Older',
          albumArtists: [],
          albumInteractions: at('2026-06-06T01:00:00.000Z'),
        },
      ]);

      await libraryService.findAll(userId, { pagination: { limit: 1 } });

      expect(mockAlbumService.findAlbumCoverMap).toHaveBeenCalledWith([
        'al-newer',
      ]);
    });

    it('returns an empty library without resolving any artwork', async () => {
      const result = await libraryService.findAll(userId);

      expect(result).toEqual([]);
      expect(mockAlbumService.findAlbumCoverMap).not.toHaveBeenCalled();
      expect(mockArtistService.findArtistImageMap).not.toHaveBeenCalled();
    });
  });
});
