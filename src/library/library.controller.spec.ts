import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { LibraryItem, LibraryItemType } from './library.types.js';
import { PlaylistType } from '../generated/prisma/enums.js';
import { APP_GUARD } from '@nestjs/core';
import { toJson } from '../common/test.js';
import { PrismaClientExceptionFilter } from '../prisma/prisma.filter.js';

const items: LibraryItem[] = [
  {
    type: LibraryItemType.ARTIST,
    artist: { id: 'artist-1', name: 'Test Artist', isVarious: false },
    coverUrl: null,
    lastInteractedAt: new Date('2026-06-06T03:00:00.000Z'),
  },
  {
    type: LibraryItemType.PLAYLIST,
    playlist: { id: 'playlist-1', name: 'Test Playlist' },
    coverUrls: [],
    playlistType: PlaylistType.USER,
    lastInteractedAt: null,
  },
];

describe('LibraryController', () => {
  let app: INestApplication<App>;

  const libraryService = {
    findAll: jest.fn<LibraryService['findAll']>().mockResolvedValue(items),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        {
          provide: LibraryService,
          useValue: libraryService,
        },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<Request>();
              req.user = {
                sub: 'test-user',
                isAdmin: false,
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
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('findAll', () => {
    it('should return the library for the current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/library')
        .expect(200);

      expect(res.body).toEqual(toJson(items));
      expect(libraryService.findAll).toHaveBeenCalledWith('test-user', {
        pagination: { limit: undefined, offset: undefined },
        type: undefined,
      });
    });

    it('forwards pagination to the service', async () => {
      await request(app.getHttpServer())
        .get('/library?limit=5&offset=10')
        .expect(200);

      expect(libraryService.findAll).toHaveBeenCalledWith('test-user', {
        pagination: { limit: 5, offset: 10 },
        type: undefined,
      });
    });

    it('forwards the type filter to the service', async () => {
      await request(app.getHttpServer())
        .get('/library?type=artist')
        .expect(200);

      expect(libraryService.findAll).toHaveBeenCalledWith('test-user', {
        pagination: { limit: undefined, offset: undefined },
        type: LibraryItemType.ARTIST,
      });
    });

    it('rejects a type outside the enum', async () => {
      await request(app.getHttpServer()).get('/library?type=song').expect(400);

      expect(libraryService.findAll).not.toHaveBeenCalled();
    });

    it('rejects a limit above the maximum', async () => {
      await request(app.getHttpServer()).get('/library?limit=201').expect(400);

      expect(libraryService.findAll).not.toHaveBeenCalled();
    });

    it('rejects a negative offset', async () => {
      await request(app.getHttpServer()).get('/library?offset=-1').expect(400);

      expect(libraryService.findAll).not.toHaveBeenCalled();
    });
  });
});
