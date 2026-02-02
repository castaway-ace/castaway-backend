import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service.js';
import { UserRepository } from '../user/user.repository.js';
import { TokenRepository } from './token.repository.js';
import {
  UserWithProviders,
  UserWithProvidersAndTokens,
} from '../user/user.types.js';
import { RefreshToken, UserRole } from '../generated/prisma/client.js';

const fixedDate = new Date('2026-02-01');

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  let findByEmailMock: jest.Mock;
  let createWithProviderMock: jest.Mock;
  let createRefreshTokenMock: jest.Mock;
  let linkProviderMock: jest.Mock;
  let updateUserMock: jest.Mock;
  let findByIdMock: jest.Mock;
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

  const mockOAuthUser: UserWithProviders = {
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

  const mockAccessToken = 'mock-access-token';
  const mockRefreshToken = 'mock-refresh-token';
  const mockHashedToken = 'hashed-refresh-token';

  beforeEach(async () => {
    findByEmailMock = jest.fn();
    createWithProviderMock = jest.fn();
    linkProviderMock = jest.fn();
    updateUserMock = jest.fn();
    findByIdMock = jest.fn();
    createRefreshTokenMock = jest.fn();
    findAuthorizationCodeMock = jest.fn();
    deleteAuthorizationCodeMock = jest.fn();
    deleteTokenMock = jest.fn();
    deleteAllUserTokensMock = jest.fn();
    rotateTokenMock = jest.fn();
    signAsyncMock = jest.fn();
    verifyAsyncMock = jest.fn();

    const mockUserRepository = {
      findByEmail: findByEmailMock,
      findById: findByIdMock,
      createWithProvider: createWithProviderMock,
      linkProvider: linkProviderMock,
      updateUser: updateUserMock,
      hasProvider: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    const mockTokenRepository = {
      createRefreshToken: createRefreshTokenMock,
      findAuthorizationCode: findAuthorizationCodeMock,
      deleteAuthorizationCode: deleteAuthorizationCodeMock,
      deleteToken: deleteTokenMock,
      deleteAllUserTokens: deleteAllUserTokensMock,
      rotateToken: rotateTokenMock,
    } as unknown as jest.Mocked<TokenRepository>;

    const mockJwtService = {
      signAsync: signAsyncMock,
      verifyAsync: verifyAsyncMock,
    } as unknown as jest.Mocked<JwtService>;

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'auth.jwt.secret': 'test-jwt-secret',
          'auth.jwtRefresh.secret': 'test-refresh-secret',
          'auth.allowedEmails': 'test@example.com,admin@example.com',
        };
        return config[key] || '';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: TokenRepository,
          useValue: mockTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    tokenRepository = module.get(TokenRepository);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Default bcrypt behavior
    mockedBcrypt.hash.mockResolvedValue(mockHashedToken as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('oauthLogin', () => {
    describe('when user does not exist', () => {
      it('should create new user and return tokens', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const result = await service.oauthLogin(mockOAuthUser);

        expect(createWithProviderMock).toHaveBeenCalledWith({
          email: 'test@example.com',
          name: 'Test User',
          role: UserRole.USER,
          createdAt: fixedDate,
          updatedAt: fixedDate,
          id: 'user-123',
          avatar: 'https://example.com/avatar.jpg',
          providers: mockOAuthUser.providers,
        });
        expect(result).toEqual({
          user: mockUser,
          tokens: {
            accessToken: mockAccessToken,
            refreshToken: mockRefreshToken,
          },
        });
        expect(createRefreshTokenMock).toHaveBeenCalledWith({
          userId: 'user-123',
          hashedToken: mockHashedToken,
          expiresAt: expect.any(Date) as Date,
        });
      });

      it('should hash refresh token before storing', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(mockedBcrypt.hash).toHaveBeenCalledWith(mockRefreshToken, 10);
        expect(createRefreshTokenMock).toHaveBeenCalledWith(
          expect.objectContaining({
            hashedToken: mockHashedToken,
          }),
        );
      });

      it('should set refresh token expiration to 7 days from now', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const beforeCall = new Date();
        await service.oauthLogin(mockOAuthUser);
        const afterCall = new Date();

        const createRefreshTokenCalls =
          tokenRepository.createRefreshToken.mock.calls;
        expect(createRefreshTokenCalls).toHaveLength(1);
        const callArgs = createRefreshTokenCalls[0];
        expect(callArgs).toHaveLength(1);
        const createTokenData = callArgs[0];
        const expiresAt = createTokenData.expiresAt;

        // Should be approximately 7 days from now
        const expectedMin = new Date(beforeCall);
        expectedMin.setDate(expectedMin.getDate() + 7);
        const expectedMax = new Date(afterCall);
        expectedMax.setDate(expectedMax.getDate() + 7);

        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
          expectedMin.getTime(),
        );
        expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
      });
    });

    describe('when user already exists', () => {
      it('should return tokens without creating new user', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockImplementation(
          (user, providerName, providerId) => {
            return (
              user.providers.some(
                (p) => p.name === providerName && p.providerId === providerId,
              ) || false
            );
          },
        );
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const result = await service.oauthLogin(mockOAuthUser);

        expect(createWithProviderMock).not.toHaveBeenCalled();
        expect(result.user.id).toBe('user-123');
      });

      it('should link new provider if not already linked', async () => {
        const userWithoutGoogle: UserWithProviders = {
          ...mockUser,
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

        userRepository.findByEmail.mockResolvedValue(userWithoutGoogle);
        userRepository.hasProvider.mockReturnValue(false);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(linkProviderMock).toHaveBeenCalledWith(
          'user-123',
          'google',
          'google-123',
        );
      });

      it('should not link provider if already linked', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(linkProviderMock).not.toHaveBeenCalled();
      });

      it('should update user name if provided', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserWithNewName: UserWithProviders = {
          ...mockOAuthUser,
          name: 'Updated Name',
          avatar: null,
        };

        await service.oauthLogin(oauthUserWithNewName);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Updated Name',
        });
      });

      it('should update user avatar if provided', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserWithNewAvatar: UserWithProviders = {
          ...mockOAuthUser,
          name: '',
          avatar: 'https://example.com/new-avatar.jpg',
        };

        await service.oauthLogin(oauthUserWithNewAvatar);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          avatar: 'https://example.com/new-avatar.jpg',
        });
      });

      it('should update both name and avatar if both provided', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserWithUpdates: UserWithProviders = {
          ...mockOAuthUser,
          name: 'Updated Name',
          avatar: 'https://example.com/new-avatar.jpg',
        };

        await service.oauthLogin(oauthUserWithUpdates);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Updated Name',
          avatar: 'https://example.com/new-avatar.jpg',
        });
      });

      it('should not update user if name and avatar are not provided', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserWithoutUpdates: UserWithProviders = {
          ...mockOAuthUser,
          name: '',
          avatar: null,
        };

        await service.oauthLogin(oauthUserWithoutUpdates);

        expect(updateUserMock).not.toHaveBeenCalled();
      });

      it('should update user with fresh OAuth data', async () => {
        const staleDbUser: UserWithProviders = {
          ...mockUser,
          name: 'Old Name',
          avatar: 'https://example.com/old-avatar.jpg',
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

        const freshOAuthUser: UserWithProviders = {
          ...mockOAuthUser,
          name: 'Fresh Name',
          avatar: 'https://example.com/fresh-avatar.jpg',
        };

        userRepository.findByEmail.mockResolvedValue(staleDbUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(freshOAuthUser);

        expect(updateUserMock).toHaveBeenCalledWith('user-123', {
          name: 'Fresh Name',
          avatar: 'https://example.com/fresh-avatar.jpg',
        });
      });

      it('should not update user when name is empty string', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserEmptyName: UserWithProviders = {
          ...mockOAuthUser,
          name: '',
          avatar: null,
        };

        await service.oauthLogin(oauthUserEmptyName);

        expect(updateUserMock).not.toHaveBeenCalled();
      });

      it('should not update user when name is null', async () => {
        userRepository.findByEmail.mockResolvedValue(mockUser);
        userRepository.hasProvider.mockReturnValue(true);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserNullName: UserWithProviders = {
          ...mockOAuthUser,
          name: null,
          avatar: null,
        };

        await service.oauthLogin(oauthUserNullName);

        expect(updateUserMock).not.toHaveBeenCalled();
      });

      it('should link second provider when user logs in with different provider', async () => {
        const userWithGoogle: UserWithProviders = {
          ...mockUser,
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

        const facebookOAuthUser: UserWithProviders = {
          ...mockOAuthUser,
          providers: [
            {
              id: 'provider-facebook',
              userId: 'user-123',
              name: 'facebook',
              providerId: 'facebook-456',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        };

        userRepository.findByEmail.mockResolvedValue(userWithGoogle);
        userRepository.hasProvider.mockReturnValue(false);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(facebookOAuthUser);

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
        const oauthUserWithoutEmail: UserWithProviders = {
          ...mockOAuthUser,
          email: '',
        };

        await expect(service.oauthLogin(oauthUserWithoutEmail)).rejects.toThrow(
          new UnauthorizedException('Email not provided by OAuth provider'),
        );

        expect(findByEmailMock).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException if email is not in whitelist', async () => {
        const unauthorizedOAuthUser: UserWithProviders = {
          ...mockOAuthUser,
          email: 'unauthorized@example.com',
        };

        await expect(service.oauthLogin(unauthorizedOAuthUser)).rejects.toThrow(
          new UnauthorizedException(
            'Access denied. This application is private.',
          ),
        );

        expect(findByEmailMock).not.toHaveBeenCalled();
      });

      it('should allow email in whitelist (case insensitive)', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        const oauthUserUpperCase: UserWithProviders = {
          ...mockOAuthUser,
          email: 'TEST@EXAMPLE.COM',
        };

        await expect(
          service.oauthLogin(oauthUserUpperCase),
        ).resolves.toBeDefined();
      });

      it('should throw UnauthorizedException if no allowed emails configured', async () => {
        configService.get.mockImplementation((key: string) => {
          if (key === 'auth.allowedEmails') return '';
          return 'test-secret';
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            AuthService,
            { provide: UserRepository, useValue: userRepository },
            { provide: TokenRepository, useValue: tokenRepository },
            { provide: JwtService, useValue: jwtService },
            { provide: ConfigService, useValue: configService },
          ],
        }).compile();

        const serviceWithNoEmails = module.get<AuthService>(AuthService);

        await expect(
          serviceWithNoEmails.oauthLogin(mockOAuthUser),
        ).rejects.toThrow(
          new UnauthorizedException(
            'Access control not configured. Please contact the administrator.',
          ),
        );
      });

      it('should trim whitespace from allowed emails', async () => {
        configService.get.mockImplementation((key: string) => {
          if (key === 'auth.allowedEmails')
            return '  test@example.com  ,  admin@example.com  ';
          return 'test-secret';
        });

        const module: TestingModule = await Test.createTestingModule({
          providers: [
            AuthService,
            { provide: UserRepository, useValue: userRepository },
            { provide: TokenRepository, useValue: tokenRepository },
            { provide: JwtService, useValue: jwtService },
            { provide: ConfigService, useValue: configService },
          ],
        }).compile();

        const serviceWithWhitespace = module.get<AuthService>(AuthService);

        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await expect(
          serviceWithWhitespace.oauthLogin(mockOAuthUser),
        ).resolves.toBeDefined();
      });
    });

    describe('token generation', () => {
      it('should generate JWT with correct payload', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(signAsyncMock).toHaveBeenCalledWith(
          {
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: UserRole.USER,
          },
          {
            expiresIn: '15m',
            secret: 'test-jwt-secret',
          },
        );
      });

      it('should generate refresh token with correct payload and secret', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(signAsyncMock).toHaveBeenCalledWith(
          {
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: UserRole.USER,
          },
          {
            expiresIn: '7d',
            secret: 'test-refresh-secret',
          },
        );
      });

      it('should include role in JWT payload', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(signAsyncMock).toHaveBeenCalledWith(
          {
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: UserRole.USER,
          },
          {
            expiresIn: '15m',
            secret: 'test-jwt-secret',
          },
        );
      });

      it('should include role in refresh token payload', async () => {
        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue(mockUser);
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockOAuthUser);

        expect(signAsyncMock).toHaveBeenCalledWith(
          {
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            role: UserRole.USER,
          },
          {
            expiresIn: '7d',
            secret: 'test-refresh-secret',
          },
        );
      });

      it('should include admin role in JWT for admin users', async () => {
        const mockAdminUser: UserWithProviders = {
          ...mockOAuthUser,
          role: UserRole.ADMIN,
        };

        userRepository.findByEmail.mockResolvedValue(null);
        userRepository.createWithProvider.mockResolvedValue({
          ...mockUser,
          role: UserRole.ADMIN,
        });
        jwtService.signAsync
          .mockResolvedValueOnce(mockAccessToken)
          .mockResolvedValueOnce(mockRefreshToken);

        await service.oauthLogin(mockAdminUser);

        expect(signAsyncMock).toHaveBeenCalledWith(
          expect.objectContaining({
            role: UserRole.ADMIN,
          }),
          expect.any(Object),
        );
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
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      userRepository.findById.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens(mockRefreshToken);

      expect(verifyAsyncMock).toHaveBeenCalledWith(mockRefreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(findByIdMock).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException if JWT verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      expect(findByIdMock).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException if no matching stored token', async () => {
      userRepository.findById.mockResolvedValue(mockUserWithTokens);
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

      userRepository.findById.mockResolvedValue(userWithExpiredToken);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(service.refreshTokens(mockRefreshToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token expired'),
      );

      expect(deleteTokenMock).toHaveBeenCalledWith('token-123');
    });

    it('should rotate refresh token (delete old, create new)', async () => {
      userRepository.findById.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
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
      userRepository.findById.mockResolvedValue(mockUserWithTokens);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
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

      userRepository.findById.mockResolvedValue(userWithMultipleTokens);
      mockedBcrypt.compare
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never);
      jwtService.signAsync
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

      userRepository.findById.mockResolvedValue(mockUserWithUpdatedRole);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
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

      userRepository.findById.mockResolvedValue(mockUserDowngraded);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync
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
      tokenRepository.deleteAllUserTokens.mockResolvedValue(undefined);

      await expect(service.logout('user-123')).resolves.not.toThrow();
    });
  });

  describe('exchangeAuthorizationCode', () => {
    const mockAuthCode = {
      id: 'auth-code-123',
      code: 'valid-code',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: fixedDate,
      user: mockUser,
    };

    it('should exchange valid code for tokens', async () => {
      tokenRepository.findAuthorizationCode.mockResolvedValue(mockAuthCode);
      jwtService.signAsync
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
      tokenRepository.findAuthorizationCode.mockResolvedValue(null);

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

      tokenRepository.findAuthorizationCode.mockResolvedValue(expiredAuthCode);

      await expect(
        service.exchangeAuthorizationCode('expired-code'),
      ).rejects.toThrow(
        new UnauthorizedException('Invalid or expired authorization code'),
      );

      expect(deleteAuthorizationCodeMock).not.toHaveBeenCalled();
    });

    it('should delete authorization code after successful exchange', async () => {
      tokenRepository.findAuthorizationCode.mockResolvedValue(mockAuthCode);
      jwtService.signAsync
        .mockResolvedValueOnce(mockAccessToken)
        .mockResolvedValueOnce(mockRefreshToken);

      await service.exchangeAuthorizationCode('valid-code');

      expect(deleteAuthorizationCodeMock).toHaveBeenCalledWith('auth-code-123');
    });

    it('should generate tokens for the user associated with the code', async () => {
      tokenRepository.findAuthorizationCode.mockResolvedValue(mockAuthCode);
      jwtService.signAsync
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
  });
});
