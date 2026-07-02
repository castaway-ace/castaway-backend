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
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { Album, AlbumSummary } from './albums.types.js';

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const artistRef = { id: 'artist-1', name: 'Test Artist' };

const album: Album = {
  id: 'album-1',
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
    id: 'album-1',
    title: 'test1',
    releaseDate,
    genres: ['rock'],
    artists: [artistRef],
    starred: false,
  },
];

const albumCoverUrl =
  'http://localhost:9000/albums/album-1/cover.jpg?X-Amz-Signature=test';

const toJson = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));

describe('AlbumsController', () => {
  let app: INestApplication<App>;

  const albumsService = {
    find: jest.fn<AlbumsService['find']>().mockResolvedValue(album),
    findAll: jest
      .fn<AlbumsService['findAll']>()
      .mockResolvedValue(albumSummaries),
    getAlbumCoverUrl: jest
      .fn<AlbumsService['getAlbumCoverUrl']>()
      .mockResolvedValue(albumCoverUrl),
    updateStar: jest.fn<AlbumsService['updateStar']>().mockResolvedValue(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [{ provide: AlbumsService, useValue: albumsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<Request>();
          req.user = { sub: 'test-user', isAdmin: false, deviceId: '1234' };
          return true;
        },
      })
      .compile();

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
      await request(app.getHttpServer())
        .get('/albums/album-1')
        .expect(200)
        .expect(toJson(album) as object);

      expect(albumsService.find).toHaveBeenCalledWith('test-user', 'album-1');
    });
  });

  describe('GET /albums', () => {
    it('returns a list of album summaries', async () => {
      await request(app.getHttpServer())
        .get('/albums')
        .expect(200)
        .expect(toJson(albumSummaries) as object);

      expect(albumsService.findAll).toHaveBeenCalledWith('test-user', {
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

      expect(albumsService.findAll).toHaveBeenCalledWith('test-user', {
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
        .get('/albums/album-1/cover')
        .expect(200)
        .expect(albumCoverUrl);

      expect(albumsService.getAlbumCoverUrl).toHaveBeenCalledWith('album-1');
    });
  });

  describe('POST /albums/:id/star', () => {
    it('stars the album for the requesting user', async () => {
      await request(app.getHttpServer())
        .post('/albums/album-1/star')
        .expect(204);

      expect(albumsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        'album-1',
        true,
      );
    });
  });

  describe('DELETE /albums/:id/star', () => {
    it('unstars the album for the requesting user', async () => {
      await request(app.getHttpServer())
        .delete('/albums/album-1/star')
        .expect(204);

      expect(albumsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        'album-1',
        false,
      );
    });
  });
});
