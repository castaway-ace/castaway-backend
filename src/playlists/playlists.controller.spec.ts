import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { Request } from 'express';
import request from 'supertest';

const playlist = {
  id: '1',
  name: 'test1',
  description: '',
  public: false,
  position: 0,
  ownerId: 'sub',
};

const playlists = [
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

const playlistTrack = {
  id: '1',
  playlistId: 'playlist-1',
  trackId: '1',
  position: 0,
};

const playlistTracks = [
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

const playlistDto = {
  name: 'Playlist 1',
};

describe('PlaylistsController', () => {
  let app: INestApplication<App>;

  const playlistsService = {
    find: jest.fn().mockReturnValue(playlist),
    findAll: jest.fn().mockReturnValue(playlists),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findTrack: jest.fn().mockReturnValue(playlistTrack),
    findTracks: jest.fn().mockReturnValue(playlistTracks),
    addTrack: jest.fn(),
    deleteTrack: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [
        {
          provide: PlaylistsService,
          useValue: playlistsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<Request>();
          req.user = { sub: 'sub', isAdmin: false, deviceId: '1234' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('find', () => {
    it('should return a playlist', async () => {
      return request(app.getHttpServer())
        .get('/playlists/1234')
        .expect(200)
        .expect(playlist);
    });
  });

  describe('findAll', () => {
    it('returns all playlists for the user', async () => {
      return request(app.getHttpServer())
        .get('/playlists')
        .expect(200)
        .expect(playlists);
    });
  });

  describe('create', () => {
    it('forwards the create props to the service', async () => {
      await request(app.getHttpServer())
        .post('/playlists')
        .send(playlistDto)
        .expect(201);

      expect(playlistsService.create).toHaveBeenCalledWith('sub', 'Playlist 1');
    });
  });

  describe('update', () => {
    it('forwards the update props to the service', async () => {
      await request(app.getHttpServer())
        .patch('/playlists/1234')
        .send(playlistDto)
        .expect(200);

      expect(playlistsService.update).toHaveBeenCalledWith(
        'sub',
        '1234',
        'Playlist 1',
      );
    });
  });

  describe('delete', () => {
    it('forwards the playlist id to the service', async () => {
      await request(app.getHttpServer()).delete('/playlists/1234').expect(200);

      expect(playlistsService.delete).toHaveBeenCalledWith('sub', '1234');
    });
  });

  describe('findTrack', () => {
    it('returns the matching track from the service', async () => {
      return request(app.getHttpServer())
        .get('/playlists/1234/tracks/1234')
        .expect(200)
        .expect(playlistTrack);
    });
  });

  describe('findTracks', () => {
    it('returns the playlist tracks from the service', async () => {
      return request(app.getHttpServer())
        .get('/playlists/1234/tracks')
        .expect(200)
        .expect(playlistTracks);
    });
  });

  describe('addTrack', () => {
    it('forwards the track id to the service', async () => {
      await request(app.getHttpServer())
        .post('/playlists/1234/tracks/1234')
        .expect(201);

      expect(playlistsService.addTrack).toHaveBeenCalledWith(
        'sub',
        '1234',
        '1234',
      );
    });
  });

  describe('deleteTrack', () => {
    it('forwards the track id to the service', async () => {
      await request(app.getHttpServer())
        .delete('/playlists/1234/tracks/1234')
        .expect(200);

      expect(playlistsService.deleteTrack).toHaveBeenCalledWith(
        'sub',
        '1234',
        '1234',
      );
    });
  });
});
