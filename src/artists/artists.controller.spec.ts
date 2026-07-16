import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';

const artistId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const artist = {
  id: artistId,
  name: 'Test Artist',
  bio: '',
  starred: false,
  albums: [],
  isVarious: false,
};

const artistSummaries = [
  {
    id: artistId,
    name: 'Test Artist',
    starred: false,
    isVarious: false,
  },
];

const artistImageURL = `http://localhost:9000/artists/${artistId}/image.jpg?X-Amz-Signature=test`;

describe('ArtistsController', () => {
  let app: INestApplication<App>;

  const artistsService = {
    find: jest.fn<ArtistsService['find']>().mockResolvedValue(artist),
    findAll: jest
      .fn<ArtistsService['findAll']>()
      .mockResolvedValue(artistSummaries),
    getArtistImageUrl: jest
      .fn<ArtistsService['getArtistImageUrl']>()
      .mockResolvedValue(artistImageURL),
    star: jest.fn<ArtistsService['star']>().mockResolvedValue(),
    unstar: jest.fn<ArtistsService['unstar']>().mockResolvedValue(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        {
          provide: ArtistsService,
          useValue: artistsService,
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

  describe('GET /artists/:id', () => {
    it('returns the artist for the requesting user', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}`)
        .expect(200)
        .expect(artist);

      expect(artistsService.find).toHaveBeenCalledWith('test-user', artistId);
    });

    it('rejects a malformed artist id without reaching the service', async () => {
      await request(app.getHttpServer()).get('/artists/not-a-uuid').expect(400);

      expect(artistsService.find).not.toHaveBeenCalled();
    });
  });

  describe('GET /artists', () => {
    it('returns a list of artist summaries', async () => {
      await request(app.getHttpServer())
        .get('/artists')
        .expect(200)
        .expect(artistSummaries);

      expect(artistsService.findAll).toHaveBeenCalledWith('test-user', {
        filters: {
          starred: undefined,
          search: undefined,
        },
        sortOptions: undefined,
        pagination: { limit: undefined, offset: undefined },
      });
    });

    it('forwards filters and pagination to the service', async () => {
      await request(app.getHttpServer())
        .get('/artists?starred=true&search=foo&order=name&limit=50&offset=20')
        .expect(200);

      expect(artistsService.findAll).toHaveBeenCalledWith('test-user', {
        filters: { starred: true, search: 'foo' },
        sortOptions: { order: 'name', orderBy: 'asc' },
        pagination: { limit: 50, offset: 20 },
      });
    });
  });

  describe('GET /artists/:id/image', () => {
    it('returns the image url', async () => {
      await request(app.getHttpServer())
        .get(`/artists/${artistId}/image`)
        .expect(200)
        .expect(artistImageURL);
      expect(artistsService.getArtistImageUrl).toHaveBeenCalledWith(artistId);
    });

    it('rejects a malformed artist id without reaching the service', async () => {
      await request(app.getHttpServer())
        .get('/artists/not-a-uuid/image')
        .expect(400);

      expect(artistsService.getArtistImageUrl).not.toHaveBeenCalled();
    });
  });

  describe('POST /artists/:id/star', () => {
    it('stars the artist for the requesting user', async () => {
      await request(app.getHttpServer())
        .post(`/artists/${artistId}/star`)
        .expect(204);
      expect(artistsService.star).toHaveBeenCalledWith('test-user', artistId);
    });

    it('rejects a malformed artist id without reaching the service', async () => {
      await request(app.getHttpServer())
        .post('/artists/not-a-uuid/star')
        .expect(400);

      expect(artistsService.star).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /artists/:id/star', () => {
    it('unstars the artist for the requesting user', async () => {
      await request(app.getHttpServer())
        .delete(`/artists/${artistId}/star`)
        .expect(204);
      expect(artistsService.unstar).toHaveBeenCalledWith('test-user', artistId);
    });

    it('rejects a malformed artist id without reaching the service', async () => {
      await request(app.getHttpServer())
        .delete('/artists/not-a-uuid/star')
        .expect(400);

      expect(artistsService.unstar).not.toHaveBeenCalled();
    });
  });
});
