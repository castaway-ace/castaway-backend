import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';

const searchResults = {
  artists: [],
  albums: [],
  tracks: [],
};

describe('SearchController', () => {
  let app: INestApplication<App>;

  const searchService = {
    find: jest.fn<SearchService['find']>().mockResolvedValue(searchResults),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: searchService,
        },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<Request>();
              req.user = {
                sub: 'test-user',
                deviceId: '1234',
                roles: [],
              };
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

  describe('GET /search', () => {
    it('returns the results from the service', async () => {
      await request(app.getHttpServer())
        .get('/search?query=beatles')
        .expect(200)
        .expect(searchResults);

      expect(searchService.find).toHaveBeenCalledWith('test-user', 'beatles');
    });

    it('rejects a missing query parameter', async () => {
      await request(app.getHttpServer()).get('/search').expect(400);

      expect(searchService.find).not.toHaveBeenCalled();
    });

    it('rejects an empty query', async () => {
      await request(app.getHttpServer()).get('/search?query=').expect(400);

      expect(searchService.find).not.toHaveBeenCalled();
    });

    it('rejects a query longer than 100 characters', async () => {
      const query = 'a'.repeat(101);
      await request(app.getHttpServer())
        .get(`/search?query=${query}`)
        .expect(400);

      expect(searchService.find).not.toHaveBeenCalled();
    });
  });
});
