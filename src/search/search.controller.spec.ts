import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { SearchService } from './search.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { AuthGuard } from '../auth/guards/auth.guard.js';

const moduleMocker = new ModuleMocker(global);

const searchResults = {
  artists: [],
  albums: [],
  tracks: [],
};

describe('SearchController', () => {
  let app: INestApplication<App>;

  const searchService = {
    find: jest.fn().mockReturnValue(searchResults),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: searchService,
        },
      ],
    })
      .useMocker((token) => {
        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(token) as MockMetadata<
            any,
            any
          >;
          const Mock = moduleMocker.generateFromMetadata(
            mockMetadata,
          ) as ObjectConstructor;
          return new Mock();
        }
      })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<Request>();
          req.user = { sub: 'sub', isAdmin: false, deviceId: '1234' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('find', () => {
    it('returns the results from the service', async () => {
      await request(app.getHttpServer())
        .get('/search?query=beatles')
        .expect(200)
        .expect(searchResults);

      expect(searchService.find).toHaveBeenCalledWith('sub', 'beatles');
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
