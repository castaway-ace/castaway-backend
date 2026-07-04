import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { InteractionsService } from './interactions.service.js';
import { InteractionType } from './interactions.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';

type ArtistInteractionRow = {
  id: string;
  updatedAt: Date;
  artist: { id: string; name: string };
};

type PlaylistInteractionRow = {
  id: string;
  updatedAt: Date;
  playlist: { id: string; name: string };
};

type AlbumInteractionRow = {
  id: string;
  updatedAt: Date;
  album: {
    id: string;
    title: string;
    albumArtists: { artist: { id: string; name: string } }[];
  };
};

const userId = 'user-1';

const artistRef = { id: 'artist-1', name: 'Test Artist' };

const artistInteraction: ArtistInteractionRow = {
  id: 'ai-1',
  updatedAt: new Date('2026-06-06T03:00:00.000Z'),
  artist: artistRef,
};

const playlistInteraction: PlaylistInteractionRow = {
  id: 'pi-1',
  updatedAt: new Date('2026-06-06T02:00:00.000Z'),
  playlist: { id: 'playlist-1', name: 'Test Playlist' },
};

const albumInteraction: AlbumInteractionRow = {
  id: 'bi-1',
  updatedAt: new Date('2026-06-06T01:00:00.000Z'),
  album: {
    id: 'album-1',
    title: 'Test Album',
    albumArtists: [{ artist: artistRef }],
  },
};

describe('InteractionsService', () => {
  let interactionsService: InteractionsService;

  const mockPrismaService = {
    artistInteraction: {
      findMany: jest.fn<() => Promise<ArtistInteractionRow[]>>(),
      upsert:
        jest.fn<
          (args: Prisma.ArtistInteractionUpsertArgs) => Promise<unknown>
        >(),
    },
    playlistInteraction: {
      findMany: jest.fn<() => Promise<PlaylistInteractionRow[]>>(),
      upsert:
        jest.fn<
          (args: Prisma.PlaylistInteractionUpsertArgs) => Promise<unknown>
        >(),
    },
    albumInteraction: {
      findMany: jest.fn<() => Promise<AlbumInteractionRow[]>>(),
      upsert:
        jest.fn<
          (args: Prisma.AlbumInteractionUpsertArgs) => Promise<unknown>
        >(),
    },
  };

  const mockPlaylistService = {
    findPlaylistCovers: jest.fn<() => Promise<string[]>>(),
  };

  const mockArtistService = {
    findArtistImageMap: jest.fn<ArtistsService['findArtistImageMap']>(),
  };

  const mockAlbumService = {
    findAlbumCoverMap: jest.fn<AlbumsService['findAlbumCoverMap']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.artistInteraction.findMany.mockResolvedValue([
      artistInteraction,
    ]);
    mockPrismaService.playlistInteraction.findMany.mockResolvedValue([
      playlistInteraction,
    ]);
    mockPrismaService.albumInteraction.findMany.mockResolvedValue([
      albumInteraction,
    ]);
    mockArtistService.findArtistImageMap.mockResolvedValue(
      new Map([['artist-1', 'https://cdn/artist-1.jpg']]),
    );
    mockAlbumService.findAlbumCoverMap.mockResolvedValue(
      new Map([['album-1', 'https://cdn/album-1.jpg']]),
    );
    mockPlaylistService.findPlaylistCovers.mockResolvedValue([
      'https://cdn/cover-1.jpg',
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlaylistsService,
          useValue: mockPlaylistService,
        },
        {
          provide: ArtistsService,
          useValue: mockArtistService,
        },
        {
          provide: AlbumsService,
          useValue: mockAlbumService,
        },
      ],
    }).compile();

    interactionsService = module.get(InteractionsService);
  });

  describe('findAll', () => {
    it('merges all interaction types sorted by recency', async () => {
      const result = await interactionsService.findAll(userId);

      expect(result).toEqual([
        {
          ...artistInteraction,
          type: InteractionType.ARTIST,
          coverUrl: 'https://cdn/artist-1.jpg',
        },
        {
          ...playlistInteraction,
          type: InteractionType.PLAYLIST,
          coverUrls: ['https://cdn/cover-1.jpg'],
        },
        {
          id: 'bi-1',
          updatedAt: albumInteraction.updatedAt,
          type: InteractionType.ALBUM,
          album: { id: 'album-1', title: 'Test Album' },
          artists: [artistRef],
          coverUrl: 'https://cdn/album-1.jpg',
        },
      ]);
    });

    it('applies the global limit after merging', async () => {
      const result = await interactionsService.findAll(userId, 2);

      expect(result).toHaveLength(2);
      expect(result.map((interaction) => interaction.id)).toEqual([
        'ai-1',
        'pi-1',
      ]);
    });

    it('resolves covers through batched maps', async () => {
      await interactionsService.findAll(userId);

      expect(mockAlbumService.findAlbumCoverMap).toHaveBeenCalledWith([
        'album-1',
      ]);
      expect(mockArtistService.findArtistImageMap).toHaveBeenCalledWith([
        'artist-1',
      ]);
    });

    it('returns null covers when an entity has no image', async () => {
      mockArtistService.findArtistImageMap.mockResolvedValue(new Map());
      mockAlbumService.findAlbumCoverMap.mockResolvedValue(new Map());

      const result = await interactionsService.findAll(userId);

      const artist = result.find(
        (interaction) => interaction.type === InteractionType.ARTIST,
      );
      const album = result.find(
        (interaction) => interaction.type === InteractionType.ALBUM,
      );

      expect(artist).toMatchObject({ coverUrl: null });
      expect(album).toMatchObject({ coverUrl: null });
    });

    it('degrades playlist covers to an empty array on failure', async () => {
      mockPlaylistService.findPlaylistCovers.mockRejectedValue(
        new Error('storage unavailable'),
      );

      const result = await interactionsService.findAll(userId);

      const playlist = result.find(
        (interaction) => interaction.type === InteractionType.PLAYLIST,
      );

      expect(playlist).toMatchObject({ coverUrls: [] });
    });
  });

  describe('createOrUpdateAlbum', () => {
    it('upserts the interaction', async () => {
      await interactionsService.createOrUpdateAlbum(userId, 'album-1');

      const [upsertArgs] =
        mockPrismaService.albumInteraction.upsert.mock.calls[0];
      expect(upsertArgs).toMatchObject({
        where: { userId_albumId: { userId, albumId: 'album-1' } },
        create: { userId, albumId: 'album-1' },
      });
    });
  });

  describe('createOrUpdateArtist', () => {
    it('upserts the interaction', async () => {
      await interactionsService.createOrUpdateArtist(userId, 'artist-1');

      const [upsertArgs] =
        mockPrismaService.artistInteraction.upsert.mock.calls[0];
      expect(upsertArgs).toMatchObject({
        where: { userId_artistId: { userId, artistId: 'artist-1' } },
        create: { userId, artistId: 'artist-1' },
      });
    });
  });

  describe('createOrUpdatePlaylist', () => {
    it('upserts the interaction', async () => {
      await interactionsService.createOrUpdatePlaylist(userId, 'playlist-1');

      const [upsertArgs] =
        mockPrismaService.playlistInteraction.upsert.mock.calls[0];
      expect(upsertArgs).toMatchObject({
        where: { userId_playlistId: { userId, playlistId: 'playlist-1' } },
        create: { userId, playlistId: 'playlist-1' },
      });
    });
  });
});
