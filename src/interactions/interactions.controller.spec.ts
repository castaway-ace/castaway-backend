import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { Interaction, InteractionType } from './interactions.types.js';
import { APP_GUARD } from '@nestjs/core';
import { toJson } from '../common/test.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaClientExceptionFilter } from '../prisma/prisma.filter.js';

const entityId = '11111111-1111-1111-1111-111111111111';
const unknownId = '99999999-9999-9999-9999-999999999999';

const interactions: Interaction[] = [
  {
    id: 'ai-1',
    updatedAt: new Date('2026-06-06T03:00:00.000Z'),
    type: InteractionType.ARTIST,
    artist: { id: 'artist-1', name: 'Test Artist' },
    coverUrl: null,
  },
];

describe('InteractionsController', () => {
  let app: INestApplication<App>;

  const interactionsService = {
    findAll: jest
      .fn<InteractionsService['findAll']>()
      .mockResolvedValue(interactions),
    createOrUpdateAlbum: jest.fn<InteractionsService['createOrUpdateAlbum']>(),
    createOrUpdateArtist:
      jest.fn<InteractionsService['createOrUpdateArtist']>(),
    createOrUpdatePlaylist:
      jest.fn<InteractionsService['createOrUpdatePlaylist']>(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InteractionsController],
      providers: [
        {
          provide: InteractionsService,
          useValue: interactionsService,
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
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('findAll', () => {
    it('should return an array of interactions', async () => {
      const res = await request(app.getHttpServer())
        .get('/interactions')
        .expect(200);

      expect(res.body).toEqual(toJson(interactions));
      expect(interactionsService.findAll).toHaveBeenCalledWith(
        'test-user',
        undefined,
      );
    });

    it('forwards the limit to the service', async () => {
      await request(app.getHttpServer())
        .get('/interactions?limit=5')
        .expect(200);

      expect(interactionsService.findAll).toHaveBeenCalledWith('test-user', 5);
    });

    it('rejects a limit above the maximum', async () => {
      await request(app.getHttpServer())
        .get('/interactions?limit=51')
        .expect(400);

      expect(interactionsService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('createOrUpdateAlbum', () => {
    it('calls createOrUpdateAlbum with the respective props', async () => {
      await request(app.getHttpServer())
        .post(`/interactions/albums/${entityId}`)
        .expect(204);
      expect(interactionsService.createOrUpdateAlbum).toHaveBeenCalledWith(
        'test-user',
        entityId,
      );
    });

    it('returns 404 through the Prisma filter for an unknown id', async () => {
      interactionsService.createOrUpdateAlbum.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '7.0.0',
        }),
      );

      const res = await request(app.getHttpServer())
        .post(`/interactions/albums/${unknownId}`)
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        message: 'Referenced record not found',
      });
    });
  });

  describe('createOrUpdateArtist', () => {
    it('calls createOrUpdateArtist with the respective props', async () => {
      await request(app.getHttpServer())
        .post(`/interactions/artists/${entityId}`)
        .expect(204);
      expect(interactionsService.createOrUpdateArtist).toHaveBeenCalledWith(
        'test-user',
        entityId,
      );
    });
  });

  describe('createOrUpdatePlaylist', () => {
    it('calls createOrUpdatePlaylist with the respective props', async () => {
      await request(app.getHttpServer())
        .post(`/interactions/playlists/${entityId}`)
        .expect(204);
      expect(interactionsService.createOrUpdatePlaylist).toHaveBeenCalledWith(
        'test-user',
        entityId,
      );
    });
  });
});
