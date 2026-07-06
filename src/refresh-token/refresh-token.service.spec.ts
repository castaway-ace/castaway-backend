import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service.js';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenWithDevice } from './refresh-token.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';

const configValues: Readonly<Record<string, unknown>> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRATION: '15m',
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
    model: 'iPhone 15',
    activatedAt: new Date(Date.now()),
    lastSeenAt: new Date(Date.now()),
  },
  ...overrides,
});

describe('RefreshTokenService', () => {
  let refreshTokenService: RefreshTokenService;

  const findUnique = jest.fn<() => Promise<RefreshTokenWithDevice | null>>();
  const revokeUpdateMany =
    jest.fn<
      (args: Prisma.RefreshTokenUpdateManyArgs) => Promise<{ count: number }>
    >();
  const deleteMany =
    jest.fn<
      (args: Prisma.RefreshTokenDeleteManyArgs) => Promise<{ count: number }>
    >();

  const claimUpdateMany = jest.fn<() => Promise<{ count: number }>>();
  const claimCreate = jest.fn<() => Promise<{ id: string }>>();
  const claimUpdate = jest.fn<() => Promise<unknown>>();
  const deviceUpdate = jest.fn<() => Promise<unknown>>();

  const signAsync = jest.fn<JwtService['signAsync']>();

  const findById =
    jest.fn<() => Promise<{ id: string; isAdmin: boolean } | null>>();

  type TxClient = {
    refreshToken: {
      updateMany: typeof claimUpdateMany;
      create: typeof claimCreate;
      update: typeof claimUpdate;
    };
    device: {
      update: typeof deviceUpdate;
    };
  };

  const txClient = {
    refreshToken: {
      updateMany: claimUpdateMany,
      create: claimCreate,
      update: claimUpdate,
    },
    device: { update: deviceUpdate },
  };

  const $transaction = jest.fn(
    (callback: (tx: TxClient) => Promise<unknown>): Promise<unknown> =>
      callback(txClient),
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              findUnique,
              updateMany: revokeUpdateMany,
              deleteMany,
            },
            $transaction,
          },
        },
        { provide: UsersService, useValue: { findById } },
        { provide: JwtService, useValue: { signAsync } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string): unknown => configValues[key]),
          },
        },
      ],
    }).compile();

    refreshTokenService = module.get(RefreshTokenService);
  });

  it('throws an Invalid error when the refresh token can not be found', async () => {
    findUnique.mockResolvedValue(null);
    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Invalid refresh token',
    );
  });

  it('prunes expired and long-invalidated tokens', async () => {
    deleteMany.mockResolvedValue({ count: 3 });

    const count = await refreshTokenService.pruneExpiredTokens();

    expect(count).toBe(3);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const where = deleteMany.mock.calls[0][0].where as unknown as {
      OR: { expiresAt?: { lt: Date }; invalidatedAt?: { lt: Date } }[];
    };
    expect(where.OR[0].expiresAt?.lt).toBeInstanceOf(Date);
    expect(where.OR[1].invalidatedAt?.lt).toBeInstanceOf(Date);
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

  it('revokes the family when a used token is replayed', async () => {
    findUnique.mockResolvedValue(makeMockDevice({ usedAt: new Date() }));
    revokeUpdateMany.mockResolvedValue({ count: 1 });

    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Refresh token reuse detected',
    );

    const [revokeArgs] = revokeUpdateMany.mock.calls[0];
    expect(revokeArgs).toMatchObject({
      where: { familyId: 'fam-1', invalidatedAt: null },
    });
    expect(revokeArgs.data.invalidatedAt).toBeInstanceOf(Date);
  });

  it('rejects a lost concurrent claim without revoking the family', async () => {
    findUnique.mockResolvedValue(makeMockDevice());
    findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
    signAsync.mockResolvedValue('access-user-1');
    claimUpdateMany.mockResolvedValue({ count: 0 });

    await expect(refreshTokenService.rotate('raw')).rejects.toThrow(
      'Invalid refresh token',
    );
    expect(revokeUpdateMany).not.toHaveBeenCalled();
  });

  it('rotates successfully', async () => {
    findUnique.mockResolvedValue(makeMockDevice());
    findById.mockResolvedValue({ id: 'user-1', isAdmin: false });
    claimUpdateMany.mockResolvedValue({ count: 1 });
    claimCreate.mockResolvedValue({ id: 'rt-2' });
    claimUpdate.mockResolvedValue(undefined);
    deviceUpdate.mockResolvedValue(undefined);
    signAsync.mockResolvedValue('access-user-1');

    const result = await refreshTokenService.rotate('raw');

    expect(result.accessToken).toBe('access-user-1');
    expect(claimUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { replacedById: 'rt-2' },
    });
    expect(deviceUpdate).toHaveBeenCalled();
  });
});
