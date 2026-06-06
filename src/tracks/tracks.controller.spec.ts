import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Readable } from 'node:stream';
import { TracksController } from './tracks.controller.js';
import { TracksService } from './tracks.service.js';
import { App } from 'supertest/types.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { Request } from 'express';

const track = {
  id: '1',
  title: 'track',
};

const trackSummaries = [
  {
    id: '1',
    title: 'track-1',
  },
  {
    id: '2',
    title: 'track-2',
  },
];

const trackStream = {
  stream: Readable.from(Buffer.from('audio file')),
  contentType: 'audio/flac',
  contentLength: 10,
};

describe('TracksController', () => {
  let app: INestApplication<App>;
  const tracksService = {
    find: jest.fn().mockReturnValue(track),
    findAll: jest.fn().mockReturnValue(trackSummaries),
    findTrackStream: jest.fn().mockReturnValue(trackStream),
    updateStar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TracksController],
      providers: [
        {
          provide: TracksService,
          useValue: tracksService,
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
    it('should return a track', async () => {
      return request(app.getHttpServer())
        .get('/tracks/1234')
        .expect(200)
        .expect(track);
    });
  });

  describe('findAll', () => {
    it('should return an array of tracks', async () => {
      return request(app.getHttpServer())
        .get('/tracks')
        .expect(200)
        .expect(trackSummaries);
    });
  });

  describe('findTrackStream', () => {
    it('should return the stream of a track', async () => {
      const res = await request(app.getHttpServer())
        .get('/tracks/1234/stream')
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/flac');
      expect(res.body).toEqual(Buffer.from('audio file'));
    });
  });

  describe('star', () => {
    it('calls updateStar with true', async () => {
      await request(app.getHttpServer()).post('/tracks/1234/star').expect(204);
      expect(tracksService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        true,
      );
    });
  });

  describe('unStar', () => {
    it('calls updateStar with false', async () => {
      await request(app.getHttpServer())
        .delete('/tracks/1234/star')
        .expect(204);
      expect(tracksService.updateStar).toHaveBeenCalledWith(
        'test-user',
        '1234',
        false,
      );
    });
  });
});
