import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { RefreshTokenService } from './refresh-token.service.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenWithDevice } from '../types/refresh-token.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserService } from '../user/user.service.js';

const moduleMocker = new ModuleMocker(global);

const configValues: Readonly<Record<string, unknown>> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRATION: '1h',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRATION: '7d',
};

const makeMockDevice = (
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

describe('RefreshTokenService', () => {
  let refreshTokenService: RefreshTokenService;

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
            get: jest.fn((key: string): unknown => configValues[key]),
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
      .compile();

    refreshTokenService = module.get(RefreshTokenService);

    jest.spyOn(refreshTokenService, 'generateTokens').mockResolvedValue({
      accessToken: 'access-user-1',
      refreshToken: 'new-raw',
      refreshExpiresAt: new Date(Date.now() + 60_000),
    });
  });

  it('should be defined', () => {
    expect(refreshTokenService).toBeDefined();
  });

  it('throws an Invalid error when the refresh token can not be found', async () => {
    findUnique.mockResolvedValue(null);
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('throws an Expired error when the refresh token has expired', async () => {
    findUnique.mockResolvedValue(
      makeMockDevice({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Refresh token expired',
    );
  });

  it('throws an Invalidated error when the refresh token has been invalidated', async () => {
    findUnique.mockResolvedValue(makeMockDevice({ invalidatedAt: new Date() }));
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Refresh token invalidated',
    );
  });

  it('throws an Reuse error when the refresh token is being reused', async () => {
    findUnique.mockResolvedValue(makeMockDevice({ usedAt: new Date() }));
    updateMany.mockResolvedValue({ count: 1 });
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Refresh token reuse detected',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-1', invalidatedAt: null },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { invalidatedAt: expect.any(Date) },
    });
  });

  it('throws an Not Found error when the user from the token can not be found', async () => {
    findUnique.mockResolvedValue(makeMockDevice());
    findById.mockResolvedValue(null);
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'User not found',
    );
  });

  it('throws Concurrent error when a concurrent rotation occurs', async () => {
    findUnique.mockResolvedValue(makeMockDevice());
    findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
    create.mockResolvedValue({ id: 'rt-2' });
    updateMany.mockResolvedValue({ count: 0 });
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Concurrent rotation detected',
    );
  });

  it('when the refresh tokens has successfully rotated', async () => {
    findUnique.mockResolvedValue(makeMockDevice());
    findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
    create.mockResolvedValue({ id: 'rt-2' });
    updateMany.mockResolvedValue({ count: 1 });
    deviceUpdate.mockResolvedValue(undefined);

    const result = await refreshTokenService.rotate('raw');
    expect(result.accessToken).toBe('access-user-1');
    expect(deviceUpdate).toHaveBeenCalled();
  });
});
