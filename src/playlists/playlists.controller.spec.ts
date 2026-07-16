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

const playlistId = '11111111-1111-1111-1111-111111111111';
const trackId = '22222222-2222-2222-2222-222222222222';

const albumRef = { id: 'album-1', title: 'album' };

const artistRef = { id: 'artist-1', name: 'artist', isVarious: false };

const playlist = {
  id: '1',
  name: 'test1',
  description: null,
  ownerId: 'test-user',
  type: PlaylistType.USER,
  albumCoverUrls: [],
};

const playlists = [
  {
    id: '1',
    name: 'test1',
    type: PlaylistType.USER,
    albumCoverUrls: [],
  },
  {
    id: '2',
    name: 'test2',
    type: PlaylistType.USER,
    albumCoverUrls: [],
  },
];

const playlistRef = { id: '1', name: 'Playlist 1' };

const playlistTrack = {
  id: '1',
  trackId: '1',
  genres: [],
  duration: 300,
  trackNumber: 1,
  discNumber: 1,
  title: 'Test 1',
  album: albumRef,
  artists: [artistRef],
};

const playlistTracks = [
  playlistTrack,
  {
    id: '2',
    trackId: '2',
    genres: [],
    duration: 300,
    trackNumber: 1,
    discNumber: 1,
    title: 'Test 2',
    album: albumRef,
    artists: [artistRef],
  },
];

describe('PlaylistsController', () => {
  let app: INestApplication<App>;

  const playlistsService = {
    find: jest.fn<PlaylistsService['find']>().mockResolvedValue(playlist),
    findAll: jest
      .fn<PlaylistsService['findAll']>()
      .mockResolvedValue(playlists),
    create: jest
      .fn<PlaylistsService['create']>()
      .mockResolvedValue(playlistRef),
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

  describe('findAll', () => {
    it('returns the playlists from the service', async () => {
      await request(app.getHttpServer())
        .get('/playlists')
        .expect(200)
        .expect(playlists);

      expect(playlistsService.findAll).toHaveBeenCalledWith('test-user', {
        filters: { onlyUser: undefined },
        orderOptions: undefined,
        pagination: { limit: undefined, offset: undefined },
      });
    });

    it('forwards filters, sorting, and pagination', async () => {
      await request(app.getHttpServer())
        .get(
          '/playlists?onlyUser=true&order=added&orderBy=desc&limit=10&offset=5',
        )
        .expect(200);

      expect(playlistsService.findAll).toHaveBeenCalledWith('test-user', {
        filters: { onlyUser: true },
        orderOptions: { order: 'added', orderBy: 'desc' },
        pagination: { limit: 10, offset: 5 },
      });
    });
  });

  describe('find', () => {
    it('returns the playlist resolved by the service for the caller', async () => {
      await request(app.getHttpServer())
        .get(`/playlists/${playlistId}`)
        .expect(200)
        .expect(playlist);

      expect(playlistsService.find).toHaveBeenCalledWith(
        'test-user',
        playlistId,
      );
    });
  });

  describe('create', () => {
    it('creates a playlist and returns its reference', async () => {
      await request(app.getHttpServer())
        .post('/playlists')
        .send({ name: 'Playlist 1' })
        .expect(201)
        .expect(playlistRef);

      expect(playlistsService.create).toHaveBeenCalledWith(
        'test-user',
        'Playlist 1',
      );
    });

    it('trims the name before it reaches the service', async () => {
      await request(app.getHttpServer())
        .post('/playlists')
        .send({ name: '  Playlist 1  ' })
        .expect(201);

      expect(playlistsService.create).toHaveBeenCalledWith(
        'test-user',
        'Playlist 1',
      );
    });

    it('rejects a whitespace-only name', async () => {
      await request(app.getHttpServer())
        .post('/playlists')
        .send({ name: '   ' })
        .expect(400);

      expect(playlistsService.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('forwards the new name to the service', async () => {
      await request(app.getHttpServer())
        .patch(`/playlists/${playlistId}`)
        .send({ name: 'Playlist 1' })
        .expect(204);

      expect(playlistsService.update).toHaveBeenCalledWith(
        'test-user',
        playlistId,
        'Playlist 1',
      );
    });
  });

  describe('delete', () => {
    it('forwards the playlist id to the service', async () => {
      await request(app.getHttpServer())
        .delete(`/playlists/${playlistId}`)
        .expect(204);

      expect(playlistsService.delete).toHaveBeenCalledWith(
        'test-user',
        playlistId,
      );
    });
  });

  describe('findTrack', () => {
    it('returns the matching track from the service', async () => {
      return request(app.getHttpServer())
        .get(`/playlists/${playlistId}/tracks/${trackId}`)
        .expect(200)
        .expect(playlistTrack);
    });
  });

  describe('findTracks', () => {
    it('returns the playlist tracks from the service', async () => {
      return request(app.getHttpServer())
        .get(`/playlists/${playlistId}/tracks`)
        .expect(200)
        .expect(playlistTracks);
    });
  });

  describe('addTrack', () => {
    it('forwards the track id to the service', async () => {
      await request(app.getHttpServer())
        .post(`/playlists/${playlistId}/tracks/${trackId}`)
        .expect(204);

      expect(playlistsService.addTrack).toHaveBeenCalledWith(
        'test-user',
        playlistId,
        trackId,
      );
    });
  });

  describe('deleteTrack', () => {
    it('forwards the track id to the service', async () => {
      await request(app.getHttpServer())
        .delete(`/playlists/${playlistId}/tracks/${trackId}`)
        .expect(204);

      expect(playlistsService.deleteTrack).toHaveBeenCalledWith(
        'test-user',
        playlistId,
        trackId,
      );
    });
  });
});
