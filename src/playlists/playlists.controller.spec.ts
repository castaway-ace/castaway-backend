import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { Playlist } from '../types/playlists.js';
import { PlaylistTrack } from '../../generated/prisma/client.js';

const moduleMocker = new ModuleMocker(global);

describe('PlaylistsController', () => {
  let playlistsController: PlaylistsController;

  const mockPlaylistsService = {
    find: jest.fn<PlaylistsService['find']>(),
    findAll: jest.fn<PlaylistsService['findAll']>(),
    create: jest.fn<PlaylistsService['create']>(),
    update: jest.fn<PlaylistsService['update']>(),
    delete: jest.fn<PlaylistsService['delete']>(),
    addTrack: jest.fn<PlaylistsService['addTrack']>(),
    findTracks: jest.fn<PlaylistsService['findTracks']>(),
    findTrack: jest.fn<PlaylistsService['findTrack']>(),
    deleteTrack: jest.fn<PlaylistsService['deleteTrack']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [
        {
          provide: PlaylistsService,
          useValue: mockPlaylistsService,
        },
      ],
    })
      .useMocker((token) => {
        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(token) as MockMetadata<
            any,
            any
          >;
          const Mock = moduleMocker.generateFromMetadata(
            mockMetadata,
          ) as ObjectConstructor;
          return new Mock();
        }
      })
      .compile();

    playlistsController = module.get(PlaylistsController);
  });

  describe('find', () => {
    it('returns the playlist from the service', async () => {
      const mockPlaylist: Playlist = {
        id: '1',
        name: 'test1',
        description: '',
        public: false,
        position: 0,
        ownerId: 'sub',
      };
      mockPlaylistsService.find.mockResolvedValue(mockPlaylist);
      await expect(playlistsController.find('sub', 'playlist-1')).resolves.toBe(
        mockPlaylist,
      );
      expect(mockPlaylistsService.find).toHaveBeenCalledWith('playlist-1');
    });
  });

  describe('findAll', () => {
    it('returns all playlists for the user', async () => {
      const mockPlaylists: Playlist[] = [
        {
          id: '1',
          name: 'test1',
          description: '',
          public: false,
          position: 0,
          ownerId: 'sub',
        },
        {
          id: '2',
          name: 'test2',
          description: '',
          public: false,
          position: 1,
          ownerId: 'sub',
        },
      ];
      mockPlaylistsService.findAll.mockResolvedValue(mockPlaylists);
      await expect(playlistsController.findAll('sub')).resolves.toBe(
        mockPlaylists,
      );
      expect(mockPlaylistsService.findAll).toHaveBeenCalledWith('sub');
    });
  });

  describe('create', () => {
    it('forwards the create props to the service', async () => {
      await playlistsController.create('sub', {
        name: 'playlist-1',
      });

      expect(mockPlaylistsService.create).toHaveBeenCalledWith(
        'sub',
        'playlist-1',
      );
    });
  });

  describe('update', () => {
    it('forwards the update props to the service', async () => {
      await playlistsController.update('sub', 'playlist-id', {
        name: 'playlist-2',
      });

      expect(mockPlaylistsService.update).toHaveBeenCalledWith(
        'sub',
        'playlist-id',
        'playlist-2',
      );
    });
  });

  describe('delete', () => {
    it('forwards the playlist id to the service', async () => {
      await playlistsController.delete('sub', 'playlist-id');

      expect(mockPlaylistsService.delete).toHaveBeenCalledWith(
        'sub',
        'playlist-id',
      );
    });
  });

  describe('findTracks', () => {
    const mockPlaylistTracks: PlaylistTrack[] = [
      {
        id: '1',
        playlistId: 'playlist-1',
        trackId: '1',
        position: 0,
      },
      {
        id: '2',
        playlistId: 'playlist-1',
        trackId: '2',
        position: 1,
      },
    ];
    it('returns the playlist tracks from the service', async () => {
      mockPlaylistsService.findTracks.mockResolvedValue(mockPlaylistTracks);

      await expect(
        playlistsController.findTracks('sub', 'playlist-1'),
      ).resolves.toBe(mockPlaylistTracks);
      expect(mockPlaylistsService.findTracks).toHaveBeenCalledWith(
        'sub',
        'playlist-1',
      );
    });
  });

  describe('findTrack', () => {
    const mockPlaylistTrack: PlaylistTrack = {
      id: '1',
      playlistId: 'playlist-1',
      trackId: '1',
      position: 0,
    };
    it('returns the matching track from the service', async () => {
      mockPlaylistsService.findTrack.mockResolvedValue(mockPlaylistTrack);
      await expect(
        playlistsController.findTrack('sub', 'playlist-1', 'track-1'),
      ).resolves.toBe(mockPlaylistTrack);
      expect(mockPlaylistsService.findTrack).toHaveBeenCalledWith(
        'sub',
        'playlist-1',
        'track-1',
      );
    });
  });

  describe('addTrack', () => {
    it('forwards the track id to the service', async () => {
      await playlistsController.addTrack('sub', 'playlist-id', 'track-1');

      expect(mockPlaylistsService.addTrack).toHaveBeenCalledWith(
        'sub',
        'playlist-id',
        'track-1',
      );
    });
  });

  describe('deleteTrack', () => {
    it('forwards the track id to the service', async () => {
      await playlistsController.deleteTrack('sub', 'playlist-id', 'track-1');

      expect(mockPlaylistsService.deleteTrack).toHaveBeenCalledWith(
        'sub',
        'playlist-id',
        'track-1',
      );
    });
  });
});
