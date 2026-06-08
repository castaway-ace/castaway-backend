import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { App } from 'supertest/types.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { Request } from 'express';

const album = {
  id: '1',
  title: 'test1',
  releaseDate: '2026-06-06T00:00:00.000Z',
  artists: ['test1'],
  genres: ['test1'],
  compilation: false,
};

const albumSummaries = [
  {
    id: '1',
    title: 'test1',
    releaseDate: '2026-06-06T00:00:00.000Z',
    artists: ['test1'],
    genres: ['test1'],
  },
];

const albumCoverURL =
  'http://localhost:9000/albums/1234/cover.jpg?X-Amz-Signature=test';

describe('AlbumsController', () => {
  let app: INestApplication<App>;

  const albumsService = {
    find: jest.fn().mockReturnValue(album),
    findAll: jest.fn().mockReturnValue(albumSummaries),
    findAlbumCover: jest.fn().mockReturnValue(albumCoverURL),
    updateStar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [
        {
          provide: AlbumsService,
          useValue: albumsService,
        },
      ],
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
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('find', () => {
    it('should return an album', async () => {
      return request(app.getHttpServer())
        .get('/albums/1234')
        .expect(200)
        .expect(album);
    });
  });

  describe('findAll', () => {
    it('should return an array of albums', async () => {
      return request(app.getHttpServer())
        .get('/albums')
        .expect(200)
        .expect(albumSummaries);
    });
  });

  describe('findAlbumCover', () => {
    it('should return the presigned url of an album cover', async () => {
      await request(app.getHttpServer())
        .get('/albums/1234/cover')
        .expect(200)
        .expect(albumCoverURL);
    });
  });

  describe('star', () => {
    it('calls updateStar with true', async () => {
      await request(app.getHttpServer()).post('/albums/1234/star').expect(204);
      expect(albumsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        true,
      );
    });
  });

  describe('unStar', () => {
    it('calls updateStar with false', async () => {
      await request(app.getHttpServer())
        .delete('/albums/1234/star')
        .expect(204);
      expect(albumsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        false,
      );
    });
  });
});
