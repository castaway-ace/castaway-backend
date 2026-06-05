import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AuthController } from './auth.controller.js';
import { AuthTokens } from '../types/auth.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthenticatedUser } from './decorators/user.decorator.js';

const moduleMocker = new ModuleMocker(global);

describe('AuthController', () => {
  let app: INestApplication<App>;

  const mockAuthService = {
    login: jest.fn<AuthService['login']>(),
    signUp: jest.fn<AuthService['signUp']>(),
    refresh: jest.fn<AuthService['refresh']>(),
    logout: jest.fn<AuthService['logout']>(),
  };

  const user = {
    email: 'a@b.com',
    password: 'pw',
    deviceInfo: { name: 'phone' },
  };

  const tokens: AuthTokens = { accessToken: 'access', refreshToken: 'refresh' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  describe('login', () => {
    it('returns tokens when the user logs in successfully', async () => {
      mockAuthService.login.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(user)
        .expect(200)
        .expect(tokens);

      expect(mockAuthService.login).toHaveBeenCalledWith(user);
    });

    it('returns an error when the user logs in with invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid Credentials'),
      );

      await request(app.getHttpServer()).post('/auth/login').send(user).expect({
        message: 'Invalid Credentials',
        error: 'Unauthorized',
        statusCode: 401,
      });
    });
  });

  describe('signup', () => {
    it('returns tokens when the user signs up successfully', async () => {
      mockAuthService.signUp.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(user)
        .expect(201)
        .expect(tokens);
    });

    it('returns an error when the user signs up with invalid data', async () => {
      mockAuthService.signUp.mockRejectedValue(
        new BadRequestException('Invalid Signup Data'),
      );

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(user)
        .expect({
          message: 'Invalid Signup Data',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });

  describe('refresh', () => {
    it('returns tokens when the user successfully refreshes their tokens', async () => {
      mockAuthService.refresh.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'refresh' })
        .expect(200)
        .expect(tokens);
    });
  });

  describe('logout', () => {
    it('logs out the user successfully', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'refresh' })
        .expect(204);
    });
  });
});
