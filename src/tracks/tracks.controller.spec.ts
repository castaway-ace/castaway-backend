import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { TracksController } from './tracks.controller.js';
import { TracksService } from './tracks.service.js';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import { APP_GUARD } from '@nestjs/core';
import { toJson } from '../common/test.js';

const trackId = '11111111-1111-1111-1111-111111111111';

const albumRef = {
  id: '1',
  title: 'album-1',
};

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const track = {
  id: '1',
  title: 'track',
  genres: [],
  duration: 300,
  releaseDate,
  trackNumber: 1,
  discNumber: 1,
  size: 200,
  album: albumRef,
  artists: [],
  starred: false,
};

const trackSummaries = [
  {
    id: '1',
    title: 'track-1',
    genres: [],
    duration: 300,
    releaseDate,
    trackNumber: 1,
    album: albumRef,
    artists: [],
    starred: false,
  },
  {
    id: '2',
    title: 'track-2',
    genres: [],
    duration: 300,
    releaseDate: new Date(),
    trackNumber: 1,
    album: albumRef,
    artists: [],
    starred: false,
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
    find: jest.fn<TracksService['find']>().mockResolvedValue(track),
    findAll: jest
      .fn<TracksService['findAll']>()
      .mockResolvedValue(trackSummaries),
    getTrackStream: jest
      .fn<TracksService['getTrackStream']>()
      .mockResolvedValue(trackStream),
    setStarred: jest.fn<TracksService['setStarred']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TracksController],
      providers: [
        {
          provide: TracksService,
          useValue: tracksService,
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

  describe('GET /tracks/:id', () => {
    it('should return a track', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tracks/${trackId}`)
        .expect(200);

      expect(res.body).toEqual(toJson(track));

      expect(tracksService.find).toHaveBeenCalledWith('test-user', trackId);
    });

    it('rejects a non-UUID id with 400 before hitting the service', async () => {
      await request(app.getHttpServer()).get('/tracks/starred').expect(400);
      expect(tracksService.find).not.toHaveBeenCalled();
    });
  });

  describe('GET /tracks', () => {
    it('should return an array of tracks', async () => {
      const res = await request(app.getHttpServer()).get('/tracks').expect(200);

      expect(res.body).toEqual(toJson(trackSummaries));

      expect(tracksService.findAll).toHaveBeenCalledWith('test-user', {
        filters: {
          artistIds: undefined,
          albumIds: undefined,
          genres: undefined,
          starred: undefined,
          search: undefined,
        },
        sortOptions: undefined,
        pagination: { limit: undefined, offset: undefined },
      });
    });

    it('forwards filters and pagination to the service', async () => {
      await request(app.getHttpServer())
        .get('/tracks?starred=true&search=foo&order=title&limit=50&offset=20')
        .expect(200);

      expect(tracksService.findAll).toHaveBeenCalledWith('test-user', {
        filters: {
          albumIds: undefined,
          artistIds: undefined,
          genres: undefined,
          starred: true,
          search: 'foo',
        },
        sortOptions: { order: 'title', orderBy: 'asc' },
        pagination: { limit: 50, offset: 20 },
      });
    });
  });

  describe('GET /tracks/:id/stream', () => {
    const bufferParser = (
      res: request.Response,
      cb: (err: Error | null, body: Buffer) => void,
    ): void => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    it('returns the full stream with a 200 when no range is requested', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tracks/${trackId}/stream`)
        .buffer(true)
        .parse(bufferParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('audio/flac');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body).toEqual(Buffer.from('audio file'));
      expect(tracksService.getTrackStream).toHaveBeenCalledWith(
        trackId,
        undefined,
      );
    });

    it('returns 206 with Content-Range when a range is requested', async () => {
      tracksService.getTrackStream.mockResolvedValue({
        stream: Readable.from(Buffer.from('audio')),
        contentType: 'audio/flac',
        contentLength: 5,
        contentRange: 'bytes 0-4/10',
        acceptRanges: 'bytes',
      });

      const res = await request(app.getHttpServer())
        .get(`/tracks/${trackId}/stream`)
        .set('Range', 'bytes=0-4')
        .buffer(true)
        .parse(bufferParser);

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-4/10');
      expect(res.headers['content-length']).toBe('5');
      expect(tracksService.getTrackStream).toHaveBeenCalledWith(
        trackId,
        'bytes=0-4',
      );
    });
  });

  describe('POST /tracks/:id/star', () => {
    it('calls setStarred with true', async () => {
      await request(app.getHttpServer())
        .post(`/tracks/${trackId}/star`)
        .expect(204);
      expect(tracksService.setStarred).toHaveBeenCalledWith(
        'test-user',
        trackId,
        true,
      );
    });
  });

  describe('DELETE /tracks/:id/star', () => {
    it('calls setStarred with false', async () => {
      await request(app.getHttpServer())
        .delete(`/tracks/${trackId}/star`)
        .expect(204);
      expect(tracksService.setStarred).toHaveBeenCalledWith(
        'test-user',
        trackId,
        false,
      );
    });
  });
});
