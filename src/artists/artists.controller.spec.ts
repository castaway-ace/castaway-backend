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

const artist = {
  id: 'artist-1',
  name: 'Test Artist',
  bio: '',
  starred: false,
  albums: [],
};

const artistSummaries = [
  {
    id: 'artist-1',
    name: 'Test Artist',
    starred: false,
  },
];

const artistImageURL =
  'http://localhost:9000/artists/1234/image.jpg?X-Amz-Signature=test';

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
        .get('/artists/artist-1')
        .expect(200)
        .expect(artist);

      expect(artistsService.find).toHaveBeenCalledWith('test-user', 'artist-1');
    });
  });

  describe('GET /artists', () => {
    it('returns a list of artist summaries', async () => {
      return request(app.getHttpServer())
        .get('/artists')
        .expect(200)
        .expect(artistSummaries);
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
        .get('/artists/artist-1/image')
        .expect(200)
        .expect(artistImageURL);
      expect(artistsService.getArtistImageUrl).toHaveBeenCalledWith('artist-1');
    });
  });

  describe('POST /artists/:id/star', () => {
    it('stars the artist for the requesting user', async () => {
      await request(app.getHttpServer())
        .post('/artists/artist-1/star')
        .expect(204);
      expect(artistsService.star).toHaveBeenCalledWith('test-user', 'artist-1');
    });
  });

  describe('DELETE /artists/:id/star', () => {
    it('unstars the artist for the requesting user', async () => {
      await request(app.getHttpServer())
        .delete('/artists/artist-1/star')
        .expect(204);
      expect(artistsService.unstar).toHaveBeenCalledWith(
        'test-user',
        'artist-1',
      );
    });
  });
});
