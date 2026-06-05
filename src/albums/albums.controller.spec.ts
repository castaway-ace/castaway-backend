import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { AlbumSummary } from '../types/albums.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AuthenticatedUser } from '../auth/decorators/user.decorator.js';

const moduleMocker = new ModuleMocker(global);

describe('AlbumsController', () => {
  let app: INestApplication<App>;

  const results: AlbumSummary[] = [
    {
      id: '1',
      title: 'test1',
      releaseDate: new Date(),
      artists: ['test1'],
      genres: ['test1'],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
    })
      .useMocker((token) => {
        if (token === AlbumsService) {
          return {
            findAlbums: jest
              .fn<() => Promise<AlbumSummary[]>>()
              .mockResolvedValue(results),
          };
        }
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
          const req = context
            .switchToHttp()
            .getRequest<{ user: AuthenticatedUser }>();
          req.user = {
            sub: 'test-user',
            deviceId: 'test-device-id',
            isAdmin: false,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('getAlbums', () => {
    const expected = JSON.parse(JSON.stringify(results)) as AlbumSummary[];
    return request(app.getHttpServer())
      .get('/albums')
      .expect(200)
      .expect(expected);
  });

  afterEach(async () => {
    await app.close();
  });
});
