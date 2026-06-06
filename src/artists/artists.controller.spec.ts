import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { Readable } from 'node:stream';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { Request } from 'express';
import request from 'supertest';

const artist = {
  id: 'artist-1',
  name: 'Test Artist',
};

const artistSummaries = [
  {
    id: 'artist-1',
    name: 'Test Artist',
  },
];

const artistImage = {
  stream: Readable.from(Buffer.from('image file')),
  contentType: 'image/jpeg',
  contentLength: 10,
};

describe('ArtistsController', () => {
  let app: INestApplication<App>;

  const artistsService = {
    find: jest.fn().mockReturnValue(artist),
    findAll: jest.fn().mockReturnValue(artistSummaries),
    findArtistImage: jest.fn().mockReturnValue(artistImage),
    updateStar: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        {
          provide: ArtistsService,
          useValue: artistsService,
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
    it('should return an artist', async () => {
      return request(app.getHttpServer())
        .get('/artists/1234')
        .expect(200)
        .expect(artist);
    });
  });

  describe('findAll', () => {
    it('should return an array of artists', async () => {
      return request(app.getHttpServer())
        .get('/artists')
        .expect(200)
        .expect(artistSummaries);
    });
  });

  describe('findArtistImage', () => {
    it('should return the image of an artist', async () => {
      const res = await request(app.getHttpServer())
        .get('/artists/1234/stream')
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.body).toEqual(Buffer.from('image file'));
    });
  });

  describe('star', () => {
    it('calls updateStar with true', async () => {
      await request(app.getHttpServer()).post('/artists/1234/star').expect(204);
      expect(artistsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        true,
      );
    });
  });

  describe('unStar', () => {
    it('calls updateStar with false', async () => {
      await request(app.getHttpServer())
        .delete('/artists/1234/star')
        .expect(204);
      expect(artistsService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        false,
      );
    });
  });
});
