import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';
import { Role } from '../generated/prisma/client.js';

const user = {
  id: '1',
  email: 'test@test.com',
  isAdmin: false,
  userName: 'user',
  roles: [Role.USER],
};

describe('UserController', () => {
  let app: INestApplication<App>;

  const usersService = {
    findById: jest.fn<UsersService['findById']>().mockResolvedValue(user),
    delete: jest.fn<UsersService['delete']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /user/me', () => {
    it('returns the authenticated user', async () => {
      await request(app.getHttpServer())
        .get('/user/me')
        .expect(200)
        .expect(user);

      expect(usersService.findById).toHaveBeenCalledWith('test-user');
    });
  });

  describe('DELETE /user/me', () => {
    it('deletes the authenticated user and returns no content', async () => {
      await request(app.getHttpServer()).delete('/user/me').expect(204);

      expect(usersService.delete).toHaveBeenCalledWith('test-user');
    });
  });
});
