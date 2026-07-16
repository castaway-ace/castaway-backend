import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { Request } from 'express';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { Album, AlbumSummary } from './albums.types.js';
import { APP_GUARD } from '@nestjs/core';
import { toJson } from '../common/test.js';

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const albumId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const artistRef = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  name: 'Test Artist',
  isVarious: false,
};

const album: Album = {
  id: albumId,
  title: 'test1',
  releaseDate,
  compilation: false,
  genres: ['rock'],
  starred: false,
  artists: [artistRef],
  tracks: [],
};

const albumSummaries: AlbumSummary[] = [
  {
    id: albumId,
    title: 'test1',
    releaseDate,
    genres: ['rock'],
    artists: [artistRef],
    starred: false,
  },
];

const albumCoverUrl = `http://localhost:9000/albums/${albumId}/cover.jpg?X-Amz-Signature=test`;

describe('AlbumsController', () => {
  let app: INestApplication<App>;

  const mockAlbumService = {
    find: jest.fn<AlbumsService['find']>().mockResolvedValue(album),
    findAll: jest
      .fn<AlbumsService['findAll']>()
      .mockResolvedValue(albumSummaries),
    getAlbumCoverUrl: jest
      .fn<AlbumsService['getAlbumCoverUrl']>()
      .mockResolvedValue(albumCoverUrl),
    star: jest.fn<AlbumsService['star']>().mockResolvedValue(),
    unstar: jest.fn<AlbumsService['unstar']>().mockResolvedValue(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [
        { provide: AlbumsService, useValue: mockAlbumService },
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

  describe('GET /albums/:id', () => {
    it('returns the album for the requesting user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/albums/${albumId}`)
        .expect(200);

      expect(res.body).toEqual(toJson(album));

      expect(mockAlbumService.find).toHaveBeenCalledWith('test-user', albumId);
    });

    it('rejects a malformed album id without reaching the service', async () => {
      await request(app.getHttpServer()).get('/albums/not-a-uuid').expect(400);

      expect(mockAlbumService.find).not.toHaveBeenCalled();
    });
  });

  describe('GET /albums', () => {
    it('returns a list of album summaries', async () => {
      const res = await request(app.getHttpServer()).get('/albums').expect(200);

      expect(res.body).toEqual(toJson(albumSummaries));

      expect(mockAlbumService.findAll).toHaveBeenCalledWith('test-user', {
        filters: {
          artistIds: undefined,
          genres: undefined,
          starred: undefined,
          search: undefined,
        },
        sortOptions: undefined,
        pagination: { limit: undefined, offset: undefined },
      });
    });

    it('passes filters, sort options, and pagination from the query string', async () => {
      await request(app.getHttpServer())
        .get('/albums?starred=true&order=year&orderBy=desc&limit=10&offset=20')
        .expect(200);

      expect(mockAlbumService.findAll).toHaveBeenCalledWith('test-user', {
        filters: {
          artistIds: undefined,
          genres: undefined,
          starred: true,
          search: undefined,
        },
        sortOptions: { order: 'year', orderBy: 'desc' },
        pagination: { limit: 10, offset: 20 },
      });
    });
  });

  describe('GET /albums/:id/cover', () => {
    it('returns the cover url', async () => {
      await request(app.getHttpServer())
        .get(`/albums/${albumId}/cover`)
        .expect(200)
        .expect(albumCoverUrl);

      expect(mockAlbumService.getAlbumCoverUrl).toHaveBeenCalledWith(albumId);
    });

    it('rejects a malformed album id without reaching the service', async () => {
      await request(app.getHttpServer())
        .get('/albums/not-a-uuid/cover')
        .expect(400);

      expect(mockAlbumService.getAlbumCoverUrl).not.toHaveBeenCalled();
    });
  });

  describe('POST /albums/:id/star', () => {
    it('stars the album for the requesting user', async () => {
      await request(app.getHttpServer())
        .post(`/albums/${albumId}/star`)
        .expect(204);

      expect(mockAlbumService.star).toHaveBeenCalledWith('test-user', albumId);
    });

    it('rejects a malformed album id without reaching the service', async () => {
      await request(app.getHttpServer())
        .post('/albums/not-a-uuid/star')
        .expect(400);

      expect(mockAlbumService.star).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /albums/:id/star', () => {
    it('unstars the album for the requesting user', async () => {
      await request(app.getHttpServer())
        .delete(`/albums/${albumId}/star`)
        .expect(204);

      expect(mockAlbumService.unstar).toHaveBeenCalledWith(
        'test-user',
        albumId,
      );
    });

    it('rejects a malformed album id without reaching the service', async () => {
      await request(app.getHttpServer())
        .delete('/albums/not-a-uuid/star')
        .expect(400);

      expect(mockAlbumService.unstar).not.toHaveBeenCalled();
    });
  });
});
