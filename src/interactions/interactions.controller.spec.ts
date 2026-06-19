import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { Request } from 'express';
import request from 'supertest';

const interactions = [{}, {}, {}];

describe('InteractionsController', () => {
  let app: INestApplication<App>;

  const interactionsService = {
    findAll: jest.fn().mockReturnValue(interactions),
    createOrUpdateAlbum: jest.fn(),
    createOrUpdateArtist: jest.fn(),
    createOrUpdatePlaylist: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InteractionsController],
      providers: [
        {
          provide: InteractionsService,
          useValue: interactionsService,
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

  describe('findAll', () => {
    it('should return an array of interactions', async () => {
      return request(app.getHttpServer())
        .get('/interactions')
        .expect(200)
        .expect(interactions);
    });
  });

  describe('createOrUpdateAlbum', () => {
    it('calls createOrUpdateAlbum with the respective props', async () => {
      await request(app.getHttpServer())
        .post('/interactions/albums/12324')
        .expect(204);
      expect(interactionsService.createOrUpdateAlbum).toHaveBeenCalledWith(
        'test-user',
        '12324',
      );
    });
  });

  describe('createOrUpdateArtist', () => {
    it('calls createOrUpdateArtist with the respective props', async () => {
      await request(app.getHttpServer())
        .post('/interactions/artists/12324')
        .expect(204);
      expect(interactionsService.createOrUpdateArtist).toHaveBeenCalledWith(
        'test-user',
        '12324',
      );
    });
  });

  describe('createOrUpdatePlaylist', () => {
    it('calls createOrUpdatePlaylist with the respective props', async () => {
      await request(app.getHttpServer())
        .post('/interactions/playlists/12324')
        .expect(204);
      expect(interactionsService.createOrUpdatePlaylist).toHaveBeenCalledWith(
        'test-user',
        '12324',
      );
    });
  });
});
