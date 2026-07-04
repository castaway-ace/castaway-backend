import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { PlaylistType } from '../generated/prisma/client.js';
import { APP_GUARD } from '@nestjs/core';

const albumRef = { id: 'album-1', title: 'album' };

const artistRef = { id: 'artist-1', name: 'artist' };

const playlist = {
  id: '1',
  name: 'test1',
  description: '',
  public: false,
  position: 0,
  ownerId: 'test-user',
  type: PlaylistType.USER,
  albumCoverUrls: [],
};

const playlists = [
  {
    id: '1',
    name: 'test1',
    description: '',
    public: false,
    position: 0,
    type: PlaylistType.USER,
    ownerId: 'test-user',
    albumCoverUrls: [],
  },
  {
    id: '2',
    name: 'test2',
    description: '',
    public: false,
    position: 1,
    type: PlaylistType.USER,
    ownerId: 'test-user',
    albumCoverUrls: [],
  },
];

const playlistTrack = {
  id: '1',
  playlistId: 'playlist-1',
  trackId: '1',
  position: 0,
  genres: [],
  duration: 300,
  trackNumber: 1,
  discNumber: 1,
  title: 'Test 2',
  album: albumRef,
  artists: [artistRef],
};

const playlistTracks = [
  {
    id: '1',
    playlistId: 'playlist-1',
    trackId: '1',
    position: 0,
    genres: [],
    duration: 300,
    trackNumber: 1,
    discNumber: 1,
    title: 'Test 1',
    album: albumRef,
    artists: [artistRef],
  },
  {
    id: '2',
    playlistId: 'playlist-1',
    trackId: '2',
    position: 1,
    genres: [],
    duration: 300,
    trackNumber: 1,
    discNumber: 1,
    title: 'Test 2',
    album: albumRef,
    artists: [artistRef],
  },
];

const playlistDto = {
  name: 'Playlist 1',
};

describe('PlaylistsController', () => {
  let app: INestApplication<App>;

  const playlistsService = {
    find: jest.fn<PlaylistsService['find']>().mockResolvedValue(playlist),
    findAll: jest
      .fn<PlaylistsService['findAll']>()
      .mockResolvedValue(playlists),
    create: jest.fn<PlaylistsService['create']>(),
    update: jest.fn<PlaylistsService['update']>(),
    delete: jest.fn<PlaylistsService['delete']>(),
    findTrack: jest
      .fn<PlaylistsService['findTrack']>()
      .mockResolvedValue(playlistTrack),
    findTracks: jest
      .fn<PlaylistsService['findTracks']>()
      .mockResolvedValue(playlistTracks),
    addTrack: jest.fn<PlaylistsService['addTrack']>(),
    deleteTrack: jest.fn<PlaylistsService['deleteTrack']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [
        {
          provide: PlaylistsService,
          useValue: playlistsService,
        },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<Request>();
              req.user = { sub: 'test-user', isAdmin: false, deviceId: '1234' };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
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

      expect(playlistsService.create).toHaveBeenCalledWith(
        'test-user',
        'Playlist 1',
      );
    });
  });

  describe('update', () => {
    it('forwards the update props to the service', async () => {
      await request(app.getHttpServer())
        .patch('/playlists/1234')
        .send(playlistDto)
        .expect(204);

      expect(playlistsService.update).toHaveBeenCalledWith(
        'test-user',
        '1234',
        'Playlist 1',
      );
    });
  });

  describe('delete', () => {
    it('forwards the playlist id to the service', async () => {
      await request(app.getHttpServer()).delete('/playlists/1234').expect(204);

      expect(playlistsService.delete).toHaveBeenCalledWith('test-user', '1234');
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
        .expect(204);

      expect(playlistsService.addTrack).toHaveBeenCalledWith(
        'test-user',
        '1234',
        '1234',
      );
    });
  });

  describe('deleteTrack', () => {
    it('forwards the track id to the service', async () => {
      await request(app.getHttpServer())
        .delete('/playlists/1234/tracks/1234')
        .expect(204);

      expect(playlistsService.deleteTrack).toHaveBeenCalledWith(
        'test-user',
        '1234',
        '1234',
      );
    });
  });
});
