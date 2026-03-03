import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service.js';
import { UserRepository } from '../user/user.repository.js';
import {
  CreateAuthorizationCodeData,
  TokenRepository,
} from './token.repository.js';
import { OAuthProfile } from './auth.types.js';
import {
  UserWithProviders,
  UserWithProvidersAndTokens,
} from '../user/user.types.js';
import { RefreshToken, UserRole } from '../generated/prisma/client.js';
import { AuthConfig } from 'src/config/config.types.js';
import { ConfigService } from '@nestjs/config';

const fixedDate = new Date('2026-02-01');

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const defaultAuthConfig: AuthConfig = {
  jwt: { secret: 'test-jwt-secret' },
  jwtRefresh: { secret: 'test-refresh-secret' },
  google: {
    clientID: 'google-client-id',
    clientSecret: 'google-client-secret',
    callbackURL: 'http://localhost/auth/google/callback',
  },
  facebook: {
    appId: 'facebook-app-id',
    appSecret: 'facebook-app-secret',
    callbackURL: 'http://localhost/auth/facebook/callback',
  },
};

describe('AuthService', () => {
  let service: AuthService;

  let findByEmailMock: jest.Mock;
  let createWithProviderMock: jest.Mock;
  let createRefreshTokenMock: jest.Mock;
  let createAuthorizationCodeMock: jest.Mock<
    Promise<void>,
    [CreateAuthorizationCodeData]
  >;
  let linkProviderMock: jest.Mock;
  let updateUserMock: jest.Mock;
  let findByIdWithTokensMock: jest.Mock;
  let findByIdWithProvidersMock: jest.Mock;
  let signAsyncMock: jest.Mock;
  let verifyAsyncMock: jest.Mock;
  let deleteTokenMock: jest.Mock;
  let rotateTokenMock: jest.Mock;
  let deleteAllUserTokensMock: jest.Mock;
  let findAuthorizationCodeMock: jest.Mock;
  let deleteAuthorizationCodeMock: jest.Mock;

  // Test data fixtures
  const mockUser: UserWithProvidersAndTokens = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    role: UserRole.USER,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    providers: [
      {
        id: 'provider-123',
        userId: 'user-123',
        name: 'google',
        providerId: 'google-123',
        createdAt: fixedDate,
        updatedAt: fixedDate,
      },
    ],
    refreshTokens: [],
  };

  const mockUserWithProviders: UserWithProviders = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    role: UserRole.USER,
    createdAt: fixedDate,
    updatedAt: fixedDate,
    providers: [
      {
        id: 'provider-123',
        userId: 'user-123',
        name: 'google',
        providerId: 'google-123',
        createdAt: fixedDate,
        updatedAt: fixedDate,
      },
    ],
  };

  const mockOAuthProfile: OAuthProfile = {
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'google',
    providerId: 'google-123',
  };

  const mockAccessToken = 'mock-access-token';
  const mockRefreshToken = 'mock-refresh-token';
  const mockHashedToken = 'hashed-refresh-token';

  const buildService = async (
    configOverrides?: Partial<AuthConfig>,
  ): Promise<AuthService> => {
    const config = { ...defaultAuthConfig, ...configOverrides };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: findByEmailMock,
            findByIdWithTokens: findByIdWithTokensMock,
            findByIdWithProviders: findByIdWithProvidersMock,
            createWithProvider: createWithProviderMock,
            linkProvider: linkProviderMock,
            updateUser: updateUserMock,
          },
        },
        {
          provide: TokenRepository,
          useValue: {
            createRefreshToken: createRefreshTokenMock,
            createAuthorizationCode: createAuthorizationCodeMock,
            findAuthorizationCode: findAuthorizationCodeMock,
            deleteAuthorizationCode: deleteAuthorizationCodeMock,
            deleteToken: deleteTokenMock,
            deleteAllUserTokens: deleteAllUserTokensMock,
            rotateToken: rotateTokenMock,
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: signAsyncMock,
            verifyAsync: verifyAsyncMock,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth') return config;
              return undefined;
            }),
          } as unknown as ConfigService,
        },
      ],
    }).compile();

    return module.get<AuthService>(AuthService);
  };

  beforeEach(async () => {
    findByEmailMock = jest.fn();
    createWithProviderMock = jest.fn();
    linkProviderMock = jest.fn();
    updateUserMock = jest.fn();
    findByIdWithTokensMock = jest.fn();
    findByIdWithProvidersMock = jest.fn();
    createRefreshTokenMock = jest.fn();
    createAuthorizationCodeMock = jest.fn() as jest.Mock<
      Promise<void>,
      [CreateAuthorizationCodeData]
    >;
    findAuthorizationCodeMock = jest.fn();
    deleteAuthorizationCodeMock = jest.fn();
    deleteTokenMock = jest.fn();
    deleteAllUserTokensMock = jest.fn();
    rotateTokenMock = jest.fn();
    signAsyncMock = jest.fn();
    verifyAsyncMock = jest.fn();

    service = await buildService();

    // Default bcrypt behavior
    mockedBcrypt.hash.mockResolvedValue(mockHashedToken as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveOAuthUser', () => {
    describe('when user does not exist', () => {
      it('should create new user and return the user', async () => {
        findByEmailMock.mockResolvedValue(null);
        createWithProviderMock.mockResolvedValue(mockUserWithProviders);

        const result = await service.resolveOAuthUser(mockOAuthProfile);

        expect(createWithProviderMock).toHaveBeenCalledWith(mockOAuthProfile);
        expect(result).toEqual(mockUserWithProviders);
      });

      it('should not generate tokens', async () => {
        findByEmailMock.mockResolvedValue(null);
        createWithProviderMock.mockResolvedValue(mockUserWithProviders);

        await service.resolveOAuthUser(mockOAuthProfile);

        expect(signAsyncMock).not.toHaveBeenCalled();
        expect(createRefreshTokenMock).not.toHaveBeenCalled();
      });
    });

    describe('when user already exists', () => {
      it('should return existing user without creating new user', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        const result = await service.resolveOAuthUser(mockOAuthProfile);

        expect(createWithProviderMock).not.toHaveBeenCalled();
        expect(result.id).toBe('user-123');
      });

      it('should link new provider if not already linked', async () => {
        const userWithoutGoogle: UserWithProviders = {
          ...mockUserWithProviders,
          providers: [
            {
              id: 'provider-facebook',
              userId: 'user-123',
              name: 'facebook',
              providerId: 'facebook-123',
              createdAt: fixedDate,
              updatedAt: fixedDate,
            },
          ],
        };

        findByEmailMock.mockResolvedValue(userWithoutGoogle);

        await service.resolveOAuthUser(mockOAuthProfile);

        expect(linkProviderMock).toHaveBeenCalledWith(
          'user-123',
          'google',
          'google-123',
        );
      });

      it('should not link provider if already linked', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        await service.resolveOAuthUser(mockOAuthProfile);

        expect(linkProviderMock).not.toHaveBeenCalled();
      });

      it('should update user name if provided', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        const oauthProfileWithNewName: OAuthProfile = {
          ...mockOAuthProfile,
          name: 'Updated Name',
          avatar: '',
        };

        await service.resolveOAuthUser(oauthProfileWithNewName);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Updated Name',
        });
      });

      it('should update user avatar if provided', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        const oauthProfileWithNewAvatar: OAuthProfile = {
          ...mockOAuthProfile,
          name: '',
          avatar: 'https://example.com/new-avatar.jpg',
        };

        await service.resolveOAuthUser(oauthProfileWithNewAvatar);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          avatar: 'https://example.com/new-avatar.jpg',
        });
      });

      it('should update both name and avatar if both provided', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        const oauthProfileWithUpdates: OAuthProfile = {
          ...mockOAuthProfile,
          name: 'Updated Name',
          avatar: 'https://example.com/new-avatar.jpg',
        };

        await service.resolveOAuthUser(oauthProfileWithUpdates);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Updated Name',
          avatar: 'https://example.com/new-avatar.jpg',
        });
      });

      it('should not update user if name and avatar are not provided', async () => {
        findByEmailMock.mockResolvedValue(mockUserWithProviders);

        const oauthProfileWithoutUpdates: OAuthProfile = {
          ...mockOAuthProfile,
          name: '',
          avatar: '',
        };

        await service.resolveOAuthUser(oauthProfileWithoutUpdates);

        expect(updateUserMock).not.toHaveBeenCalled();
      });

      it('should update user with fresh OAuth data', async () => {
        const staleDbUser: UserWithProviders = {
          ...mockUserWithProviders,
          name: 'Old Name',
          avatar: 'https://example.com/old-avatar.jpg',
        };

        const freshOAuthProfile: OAuthProfile = {
          ...mockOAuthProfile,
          name: 'Fresh Name',
          avatar: 'https://example.com/fresh-avatar.jpg',
        };

        findByEmailMock.mockResolvedValue(staleDbUser);

        await service.resolveOAuthUser(freshOAuthProfile);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Fresh Name',
          avatar: 'https://example.com/fresh-avatar.jpg',
        });
      });

      it('should link second provider when user logs in with different provider', async () => {
        const userWithGoogle: UserWithProviders = {
          ...mockUserWithProviders,
          providers: [
            {
              id: 'provider-google',
              userId: 'user-123',
              name: 'google',
              providerId: 'google-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        const facebookOAuthProfile: OAuthProfile = {
          ...mockOAuthProfile,
          provider: 'facebook',
          providerId: 'facebook-456',
        };

        findByEmailMock.mockResolvedValue(userWithGoogle);

        await service.resolveOAuthUser(facebookOAuthProfile);

        expect(linkProviderMock).toHaveBeenCalledWith(
          'user-123',
          'facebook',
          'facebook-456',
        );

        expect(createWithProviderMock).not.toHaveBeenCalled();
      });
    });

    describe('email validation', () => {
      it('should throw UnauthorizedException if email is not provided', async () => {
        const oauthProfileWithoutEmail: OAuthProfile = {
          ...mockOAuthProfile,
          email: '',
        };

        await expect(
          service.resolveOAuthUser(oauthProfileWithoutEmail),
        ).rejects.toThrow(
          new UnauthorizedException('Email not provided by OAuth provider'),
        );

        expect(findByEmailMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('createAuthorizationCode', () => {
    it('should create an authorization code and return it', async () => {
      createAuthorizationCodeMock.mockResolvedValue(undefined);

      const code = await service.createAuthorizationCode('user-123');

      expect(code).toHaveLength(64);
      expect(code).toMatch(/^[a-f0-9]{64}$/);
      expect(createAuthorizationCodeMock).toHaveBeenCalledWith({
        code,
        userId: 'user-123',
        expiresAt: expect.any(Date) as Date,
      });
    });

    it('should set expiration to 5 minutes from now', async () => {
      createAuthorizationCodeMock.mockResolvedValue(undefined);

      const beforeCall = Date.now();
      await service.createAuthorizationCode('user-123');
      const afterCall = Date.now();

      const callArgs = createAuthorizationCodeMock.mock.calls[0][0];
      const expiresAt = callArgs.expiresAt.getTime();

      const expectedMin = beforeCall + 5 * 60 * 1000;
      const expectedMax = afterCall + 5 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should generate unique codes on each call', async () => {
      createAuthorizationCodeMock.mockResolvedValue(undefined);

      const code1 = await service.createAuthorizationCode('user-123');
      const code2 = await service.createAuthorizationCode('user-123');

      expect(code1).not.toBe(code2);
    });
  });

  describe('exchangeAuthorizationCode', () => {
    const mockAuthCode = {
      id: 'auth-code-123',
      code: 'valid-code',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: fixedDate,
      user: mockUserWithProviders,
    };

    it('should exchange valid code for tokens', async () => {
      findAuthorizationCodeMock.mockResolvedValue(mockAuthCode);
      signAsyncMock
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      const result = await service.exchangeAuthorizationCode('valid-code');

      expect(findAuthorizationCodeMock).toHaveBeenCalledWith('valid-code');
      expect(deleteAuthorizationCodeMock).toHaveBeenCalledWith('auth-code-123');
      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
      });
    });

    it('should throw UnauthorizedException if code not found', async () => {
      findAuthorizationCodeMock.mockResolvedValue(null);

      await expect(
        service.exchangeAuthorizationCode('invalid-code'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authorization code'),
      );

      expect(deleteAuthorizationCodeMock).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if code is expired', async () => {
      const expiredAuthCode = {
        ...mockAuthCode,
        expiresAt: new Date(Date.now() - 1000),
      };

      findAuthorizationCodeMock.mockResolvedValue(expiredAuthCode);

      await expect(
        service.exchangeAuthorizationCode('expired-code'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authorization code'),
      );

      expect(deleteAuthorizationCodeMock).not.toHaveBeenCalled();
    });

    it('should delete authorization code after successful exchange', async () => {
      findAuthorizationCodeMock.mockResolvedValue(mockAuthCode);
      signAsyncMock
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      await service.exchangeAuthorizationCode('valid-code');

      expect(deleteAuthorizationCodeMock).toHaveBeenCalledWith('auth-code-123');
    });

    it('should generate tokens for the user associated with the code', async () => {
      findAuthorizationCodeMock.mockResolvedValue(mockAuthCode);
      signAsyncMock
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      await service.exchangeAuthorizationCode('valid-code');

      expect(signAsyncMock).toHaveBeenCalledWith(
        {
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: UserRole.USER,
        },
        expect.any(Object),
      );
    });

    it('should store hashed refresh token after exchange', async () => {
      findAuthorizationCodeMock.mockResolvedValue(mockAuthCode);
      signAsyncMock
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      await service.exchangeAuthorizationCode('valid-code');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(mockRefreshToken, 10);
      expect(createRefreshTokenMock).toHaveBeenCalledWith({
        userId: 'user-123',
        hashedToken: mockHashedToken,
        expiresAt: expect.any(Date) as Date,
      });
    });
  });

  describe('refreshTokens', () => {
    const mockStoredToken: RefreshToken = {
      id: 'token-123',
      userId: 'user-123',
      token: mockHashedToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: fixedDate,
    };

    const mockUserWithTokens: UserWithProvidersAndTokens = {
      ...mockUser,
      refreshTokens: [mockStoredToken],
    };

    beforeEach(() => {
      verifyAsyncMock.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      findByIdWithTokensMock.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens(mockRefreshToken);

      expect(verifyAsyncMock).toHaveBeenCalledWith(mockRefreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(findByIdWithTokensMock).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException if JWT verification fails', async () => {
      verifyAsyncMock.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      expect(findByIdWithTokensMock).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      findByIdWithTokensMock.mockResolvedValue(null);

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException if no matching stored token', async () => {
      findByIdWithTokensMock.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException if stored token is expired', async () => {
      const expiredToken: RefreshToken = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      };

      const userWithExpiredToken: UserWithProvidersAndTokens = {
        ...mockUser,
        refreshTokens: [expiredToken],
      };

      findByIdWithTokensMock.mockResolvedValue(userWithExpiredToken);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token expired'),
      );

      expect(deleteTokenMock).toHaveBeenCalledWith('token-123');
    });

    it('should rotate refresh token (delete old, create new)', async () => {
      findByIdWithTokensMock.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockedBcrypt.hash.mockResolvedValue('new-hashed-token' as never);

      await service.refreshTokens(mockRefreshToken);

      expect(rotateTokenMock).toHaveBeenCalledWith('token-123', {
        userId: 'user-123',
        hashedToken: 'new-hashed-token',
        expiresAt: expect.any(Date) as Date,
      });
    });

    it('should hash new refresh token during rotation', async () => {
      findByIdWithTokensMock.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      await service.refreshTokens(mockRefreshToken);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('new-refresh-token', 10);
    });

    it('should compare refresh token with all stored tokens', async () => {
      const multipleTokens: RefreshToken[] = [
        { ...mockStoredToken, id: 'token-1', token: 'hash-1' },
        { ...mockStoredToken, id: 'token-2', token: 'hash-2' },
        { ...mockStoredToken, id: 'token-3', token: 'hash-3' },
      ];

      const userWithMultipleTokens: UserWithProvidersAndTokens = {
        ...mockUser,
        refreshTokens: multipleTokens,
      };

      findByIdWithTokensMock.mockResolvedValue(userWithMultipleTokens);
      mockedBcrypt.compare
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      await service.refreshTokens(mockRefreshToken);

      expect(mockedBcrypt.compare).toHaveBeenCalledTimes(3);
      expect(rotateTokenMock).toHaveBeenCalledWith(
        'token-3',
        expect.any(Object),
      );
    });

    it('should include updated role when refreshing tokens', async () => {
      const mockUserWithUpdatedRole: UserWithProvidersAndTokens = {
        ...mockUser,
        role: UserRole.ADMIN,
        refreshTokens: [mockStoredToken],
      };

      findByIdWithTokensMock.mockResolvedValue(mockUserWithUpdatedRole);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      await service.refreshTokens(mockRefreshToken);

      expect(signAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.ADMIN,
        }),
        expect.any(Object),
      );
    });

    it('should reflect role downgrade in refreshed tokens', async () => {
      const mockUserDowngraded: UserWithProvidersAndTokens = {
        ...mockUser,
        role: UserRole.USER,
        refreshTokens: [mockStoredToken],
      };

      findByIdWithTokensMock.mockResolvedValue(mockUserDowngraded);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      signAsyncMock
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      await service.refreshTokens(mockRefreshToken);

      expect(signAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.USER,
        }),
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should delete all user tokens', async () => {
      await service.logout('user-123');

      expect(deleteAllUserTokensMock).toHaveBeenCalledWith('user-123');
    });

    it('should not throw error if user has no tokens', async () => {
      deleteAllUserTokensMock.mockResolvedValue(undefined);

      await expect(service.logout('user-123')).resolves.not.toThrow();
    });
  });
});
