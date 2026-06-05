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
import { UserService } from '../user/user.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenWithDevice } from '../types/refresh-token.js';

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
    let service: RefreshTokenService;

    const refreshConfigValues: Readonly<Record<string, unknown>> = {
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_ACCESS_EXPIRATION: '1h',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_REFRESH_EXPIRATION: '7d',
    };

    const makeRow = (
      overrides: Partial<RefreshTokenWithDevice> = {},
    ): RefreshTokenWithDevice => ({
      id: 'rt-1',
      familyId: 'fam-1',
      deviceId: 'dev-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(Date.now()),
      invalidatedAt: null,
      usedAt: null,
      replacedById: null,
      device: {
        id: 'dev-1',
        userId: 'user-1',
        clientId: '1234',
        name: 'Goose',
        model: 'IPhone 15',
        activatedAt: new Date(Date.now()),
        lastSeenAt: new Date(Date.now()),
      },
      ...overrides,
    });

    const findUnique = jest.fn<() => Promise<RefreshTokenWithDevice | null>>();
    const create = jest.fn<() => Promise<{ id: string }>>();
    const updateMany = jest.fn<() => Promise<{ count: number }>>();
    const deviceUpdate = jest.fn<() => Promise<unknown>>();
    const findById =
      jest.fn<() => Promise<{ id: string; isAdmin: boolean } | null>>();

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RefreshTokenService,
          {
            provide: PrismaService,
            useValue: {
              refreshToken: { findUnique, create, updateMany },
              device: { update: deviceUpdate },
            },
          },
          { provide: UserService, useValue: { findById } },
        ],
      })
        .useMocker((token) => {
          if (token === ConfigService) {
            return {
              get: jest.fn((key: string): unknown => refreshConfigValues[key]),
            };
          }
          if (typeof token === 'function') {
            const mockMetadata = moduleMocker.getMetadata(
              token,
            ) as MockMetadata<any, any>;
            const Mock = moduleMocker.generateFromMetadata(
              mockMetadata,
            ) as ObjectConstructor;
            return new Mock();
          }
        })
        .compile();

      service = module.get(RefreshTokenService);

      jest.spyOn(service, 'generateTokens').mockResolvedValue({
        accessToken: 'access-user-1',
        refreshToken: 'new-raw',
        refreshExpiresAt: new Date(Date.now() + 60_000),
      });
    });

    afterEach(() => {
      refresh.mockReset();
    });

    it('throws an Invalid error when the refresh token can not be found', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.rotate('raw')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('throws an Expired error when the refresh token has expired', async () => {
      findUnique.mockResolvedValue(
        makeRow({ expiresAt: new Date(Date.now() - 60_000) }),
      );
      await expect(service.rotate('raw')).rejects.toThrow(
        'Refresh token expired',
      );
    });

    it('throws an Invalidated error when the refresh token has been invalidated', async () => {
      findUnique.mockResolvedValue(makeRow({ invalidatedAt: new Date() }));
      await expect(service.rotate('raw')).rejects.toThrow(
        'Refresh token invalidated',
      );
    });

    it('throws an Reuse error when the refresh token is being reused', async () => {
      findUnique.mockResolvedValue(makeRow({ usedAt: new Date() }));
      updateMany.mockResolvedValue({ count: 1 });
      await expect(service.rotate('raw')).rejects.toThrow(
        'Refresh token reuse detected',
      );
      expect(updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', invalidatedAt: null },
        data: { invalidatedAt: expect.any(Date) },
      });
    });

    it('throws an Not Found error when the user from the token can not be found', async () => {
      findUnique.mockResolvedValue(makeRow());
      findById.mockResolvedValue(null);
      await expect(service.rotate('raw')).rejects.toThrow('User not found');
    });

    it('throws Concurrent error when a concurrent rotation occurs', async () => {
      findUnique.mockResolvedValue(makeRow());
      findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
      create.mockResolvedValue({ id: 'rt-2' });
      updateMany.mockResolvedValue({ count: 0 });
      await expect(service.rotate('raw')).rejects.toThrow(
        'Concurrent rotation detected',
      );
    });

    it('when the refresh tokens has successfully rotated', async () => {
      findUnique.mockResolvedValue(makeRow());
      findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
      create.mockResolvedValue({ id: 'rt-2' });
      updateMany.mockResolvedValue({ count: 1 });
      deviceUpdate.mockResolvedValue(undefined);

      const result = await service.rotate('raw');
      expect(result.accessToken).toBe('access-user-1');
      expect(deviceUpdate).toHaveBeenCalled();
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
