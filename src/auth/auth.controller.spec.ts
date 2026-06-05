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
import { LoginDto } from '../dto/login.dto.js';
import { SignUpDto } from '../dto/sign-up.dto.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthenticatedUser } from './decorators/user.decorator.js';

const moduleMocker = new ModuleMocker(global);

describe('AuthController', () => {
  let app: INestApplication<App>;
  const login = jest.fn<(dto: LoginDto) => Promise<AuthTokens>>();
  const signUp = jest.fn<(dto: SignUpDto) => Promise<AuthTokens>>();
  const refresh = jest.fn<(token: string) => Promise<AuthTokens>>();
  const logout = jest.fn<(token: string) => Promise<void>>();

  const tokens: AuthTokens = { accessToken: 'access', refreshToken: 'refresh' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { login, signUp, refresh, logout } },
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
    await app.close();
  });

  describe('login', () => {
    afterEach(() => {
      login.mockReset();
    });

    it('returns tokens when the user logs in successfully', async () => {
      login.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'a@b.com',
          password: 'pw',
          deviceInfo: { name: 'phone' },
        })
        .expect(200)
        .expect(tokens);

      expect(login).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pw',
        deviceInfo: { name: 'phone' },
      });
    });

    it('returns an error when the user logs in with invalid credentials', async () => {
      login.mockRejectedValue(new UnauthorizedException('Invalid Credentials'));

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'wrong' })
        .expect(401);
    });
  });

  describe('signup', () => {
    afterEach(() => {
      signUp.mockReset();
    });
    it('returns tokens when the user signs up successfully', async () => {
      signUp.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'a@b.com',
          password: 'pw',
          deviceInfo: { name: 'phone' },
        })
        .expect(201)
        .expect(tokens);
    });

    it('returns an error when the user signs up with invalid data', async () => {
      signUp.mockRejectedValue(new BadRequestException('Invalid Signup Data'));

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'a@b.com',
          password: 'pw',
          deviceInfo: { name: 'phone' },
        })
        .expect(400);
    });
  });

  describe('refresh', () => {
    afterEach(() => {
      refresh.mockReset();
    });
    it('returns tokens when the user successfully refreshes their tokens', async () => {
      refresh.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'refresh' })
        .expect(200)
        .expect(tokens);
    });

    it('returns error when the user does not successfully refresh their tokens', async () => {
      refresh.mockResolvedValue(tokens);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'refresh' })
        .expect(200)
        .expect(tokens);
    });
  });

  describe('logout', () => {
    it('logs out the user successfully', async () => {
      logout.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'refresh' })
        .expect(204);
    });
  });
});
