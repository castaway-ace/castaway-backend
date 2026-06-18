import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { AuthGuard } from '../auth/guards/auth.guard.js';

const moduleMocker = new ModuleMocker(global);

const user = {
  id: '1',
};

describe('UserController', () => {
  let app: INestApplication<App>;

  const userService = {
    findById: jest.fn().mockReturnValue(user),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
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
    it('should return a user', async () => {
      return request(app.getHttpServer())
        .get('/user/me')
        .expect(200)
        .expect({ id: '1' });
    });
  });

  describe('delete', () => {
    it('forwards the user id to the service', async () => {
      await request(app.getHttpServer()).delete('/user/me').expect(200);

      expect(userService.delete).toHaveBeenCalledWith('sub');
    });
  });
});
