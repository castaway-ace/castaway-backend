import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { SearchService } from './search.service.js';
import { ExecutionContext, INestApplication } from '@nestjs/common';
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
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('find', () => {
    it('returns the results from the service', async () => {
      return request(app.getHttpServer())
        .get('/search')
        .expect(200)
        .expect(searchResults);
    });
  });
});
