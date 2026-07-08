import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { DeviceService } from '../device/device.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhitelistService } from '../whitelist/whitelist.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuthTokensEntity } from './entities/auth-tokens.entity.js';
import { User, UserWithPassword } from '../users/users.types.js';
import { LoginDto } from './dto/login.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { DeviceDto } from '../device/dto/device.dto.js';

const password = 'CorrectHorse1Battery';

const deviceInfo = {
  clientId: 'client-1',
  name: 'phone',
  model: 'iPhone 15',
} as unknown as DeviceDto;

const tokens: AuthTokensEntity = {
  accessToken: 'access',
  refreshToken: 'refresh',
};

const userRecord: User = {
  id: 'user-1',
  email: 'a@b.com',
  userName: 'tester',
  isAdmin: false,
};

const loginDto: LoginDto = {
  email: 'a@b.com',
  password,
  deviceInfo,
};

const signUpDto: SignUpDto = {
  userName: 'tester',
  email: 'a@b.com',
  password,
  deviceInfo,
};

const txUserCreate = jest.fn<(args: Prisma.UserCreateArgs) => Promise<User>>();
const txPlaylistCreate =
  jest.fn<(args: Prisma.PlaylistCreateArgs) => Promise<{ id: string }>>();

interface TxMock {
  user: { create: typeof txUserCreate };
  playlist: { create: typeof txPlaylistCreate };
}

describe('AuthService', () => {
  let authService: AuthService;
  let passwordHash: string;

  const usersService = {
    findByEmail: jest.fn<UsersService['findByEmail']>(),
  };

  const refreshTokensService = {
    issueForDevice: jest.fn<RefreshTokenService['issueForDevice']>(),
    rotate: jest.fn<RefreshTokenService['rotate']>(),
    revokeByToken: jest.fn<RefreshTokenService['revokeByToken']>(),
  };

  const devicesService = {
    findOrCreate: jest.fn<() => Promise<{ id: string }>>(),
  };

  const whitelistService = {
    isWhitelisted: jest.fn<WhitelistService['isWhitelisted']>(),
  };

  const txMock: TxMock = {
    user: { create: txUserCreate },
    playlist: { create: txPlaylistCreate },
  };

  const prismaService = {
    $transaction: jest.fn((cb: (tx: TxMock) => Promise<User>): Promise<User> =>
      cb(txMock),
    ),
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshTokensService.issueForDevice.mockResolvedValue(tokens);
    refreshTokensService.rotate.mockResolvedValue(tokens);
    devicesService.findOrCreate.mockResolvedValue({ id: 'dev-1' });
    whitelistService.isWhitelisted.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RefreshTokenService, useValue: refreshTokensService },
        { provide: DeviceService, useValue: devicesService },
        { provide: PrismaService, useValue: prismaService },
        { provide: WhitelistService, useValue: whitelistService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('login', () => {
    it('issues tokens when the password verifies', async () => {
      const stored: UserWithPassword = { ...userRecord, passwordHash };
      usersService.findByEmail.mockResolvedValue(stored);

      const result = await authService.login(loginDto);

      expect(result).toEqual(tokens);
      expect(devicesService.findOrCreate).toHaveBeenCalledWith(
        'user-1',
        deviceInfo,
      );
      expect(refreshTokensService.issueForDevice).toHaveBeenCalledWith({
        sub: 'user-1',
        deviceId: 'dev-1',
        isAdmin: false,
      });
    });

    it('rejects when the password does not verify', async () => {
      const stored: UserWithPassword = { ...userRecord, passwordHash };
      usersService.findByEmail.mockResolvedValue(stored);

      await expect(
        authService.login({ ...loginDto, password: 'WrongPassword9' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(refreshTokensService.issueForDevice).not.toHaveBeenCalled();
    });

    it('rejects when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshTokensService.issueForDevice).not.toHaveBeenCalled();
    });

    it('rejects a non-whitelisted user even with valid credentials', async () => {
      const stored: UserWithPassword = { ...userRecord, passwordHash };
      usersService.findByEmail.mockResolvedValue(stored);
      whitelistService.isWhitelisted.mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(refreshTokensService.issueForDevice).not.toHaveBeenCalled();
    });

    it('lets an admin log in even when not whitelisted', async () => {
      const stored: UserWithPassword = {
        ...userRecord,
        isAdmin: true,
        passwordHash,
      };
      usersService.findByEmail.mockResolvedValue(stored);
      whitelistService.isWhitelisted.mockResolvedValue(false);

      const result = await authService.login(loginDto);

      expect(result).toEqual(tokens);
      expect(whitelistService.isWhitelisted).not.toHaveBeenCalled();
    });
  });

  describe('signUp', () => {
    it('creates the user with a Liked Songs playlist and issues tokens', async () => {
      txUserCreate.mockResolvedValue(userRecord);
      txPlaylistCreate.mockResolvedValue({ id: 'liked-1' });

      const result = await authService.signUp(signUpDto);

      expect(result).toEqual(tokens);

      const [userArgs] = txUserCreate.mock.calls[0];
      expect(userArgs.data).toMatchObject({
        email: 'a@b.com',
        userName: 'tester',
      });
      expect(userArgs.select).not.toHaveProperty('passwordHash');

      const [playlistArgs] = txPlaylistCreate.mock.calls[0];
      expect(playlistArgs.data).toMatchObject({
        ownerId: 'user-1',
        name: 'Liked Songs',
      });
    });

    it('propagates repository errors unchanged', async () => {
      const failure = new Error('connection lost');
      txUserCreate.mockRejectedValue(failure);

      await expect(authService.signUp(signUpDto)).rejects.toBe(failure);
    });

    it('rejects a non-whitelisted email before creating the user', async () => {
      whitelistService.isWhitelisted.mockResolvedValue(false);

      await expect(authService.signUp(signUpDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(txUserCreate).not.toHaveBeenCalled();
      expect(refreshTokensService.issueForDevice).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('delegates to the refresh token service', async () => {
      const result = await authService.refresh('raw-refresh');

      expect(result).toEqual(tokens);
      expect(refreshTokensService.rotate).toHaveBeenCalledWith('raw-refresh');
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      await authService.logout('raw-refresh');

      expect(refreshTokensService.revokeByToken).toHaveBeenCalledWith(
        'raw-refresh',
      );
    });
  });
});
