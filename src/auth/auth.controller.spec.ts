// src/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';
import type {
  RequestWithOAuthUser,
  RequestWithUser,
  Tokens,
} from './auth.types.js';
import { Response } from 'express';
import { AuthorizationCode } from '../generated/prisma/client.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    oauthLogin: jest.Mock;
    refreshTokens: jest.Mock;
    logout: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
  };
  let prismaService: {
    authorizationCode: {
      create: jest.Mock<
        Promise<AuthorizationCode>,
        [{ data: { code: string; userId: string; expiresAt: Date } }]
      >;
    };
  };

  const mockTokens: Tokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  const mockOAuthLoginResponse = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  const mockOAuthUser = {
    provider: 'google',
    providerId: 'google-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
  };

  beforeEach(async () => {
    const mockAuthService = {
      oauthLogin: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
    };

    const mockPrismaService = {
      authorizationCode: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      // Override guards to prevent them from executing
      .overrideGuard(GoogleOAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FacebookOAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('googleAuth', () => {
    it('should be defined', () => {
      expect(controller.googleAuth()).toBeDefined();
    });

    it('should initiate Google OAuth flow', async () => {
      // This method is empty as the guard handles the redirect
      await expect(controller.googleAuth()).resolves.toBeUndefined();
    });
  });

  describe('facebookAuth', () => {
    it('should be defined', () => {
      expect(controller.facebookAuth()).toBeDefined();
    });

    it('should initiate Facebook OAuth flow', async () => {
      // This method is empty as the guard handles the redirect
      await expect(controller.facebookAuth()).resolves.toBeUndefined();
    });
  });

  describe('googleAuthCallback', () => {
    let mockRequest: RequestWithOAuthUser;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockRequest = {
        user: mockOAuthUser,
      } as RequestWithOAuthUser;

      mockResponse = {
        redirect: jest.fn(),
      };
    });

    it('should handle successful Google OAuth callback', async () => {
      authService.oauthLogin.mockResolvedValue(mockOAuthLoginResponse);
      prismaService.authorizationCode.create.mockResolvedValue({
        id: 'auth-code-id',
        code: expect.any(String) as string,
        userId: 'user-123',
        expiresAt: expect.any(Date) as Date,
        createdAt: new Date(),
      });

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(authService.oauthLogin).toHaveBeenCalledWith(mockOAuthUser);
      expect(prismaService.authorizationCode.create).toHaveBeenCalledWith({
        data: {
          code: expect.any(String) as string,
          userId: 'user-123',
          expiresAt: expect.any(Date) as Date,
        },
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringMatching(/^castaway:\/\/auth\/callback\?code=.+$/),
      );
    });

    it('should create authorization code with 5 minute expiration', async () => {
      authService.oauthLogin.mockResolvedValue(mockOAuthLoginResponse);
      prismaService.authorizationCode.create.mockResolvedValue({
        id: 'auth-code-id',
        code: 'test-code',
        userId: 'user-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const beforeCall = Date.now();
      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );
      const afterCall = Date.now();

      const createCalls = prismaService.authorizationCode.create.mock.calls;
      expect(createCalls).toHaveLength(1);
      const createData = createCalls[0][0].data;
      const expiresAt = createData.expiresAt.getTime();

      // Should be approximately 5 minutes (300000ms) from now
      const expectedMin = beforeCall + 5 * 60 * 1000;
      const expectedMax = afterCall + 5 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should generate random authorization code', async () => {
      authService.oauthLogin.mockResolvedValue(mockOAuthLoginResponse);
      prismaService.authorizationCode.create.mockResolvedValue({
        id: 'auth-code-id',
        code: 'test-code',
        userId: 'user-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      const createCalls = prismaService.authorizationCode.create.mock.calls;
      const code = createCalls[0][0].data.code;

      // Should be 64 characters (32 bytes in hex)
      expect(code).toHaveLength(64);
      expect(code).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should redirect to error URL on OAuth failure', async () => {
      const error = new Error('OAuth provider error');
      authService.oauthLogin.mockRejectedValue(error);

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=OAuth%20provider%20error',
      );
      expect(prismaService.authorizationCode.create).not.toHaveBeenCalled();
    });

    it('should redirect to error URL on authorization code creation failure', async () => {
      authService.oauthLogin.mockResolvedValue(mockOAuthLoginResponse);
      prismaService.authorizationCode.create.mockRejectedValue(
        new Error('Database error'),
      );

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=Database%20error',
      );
    });

    it('should handle unknown error types', async () => {
      authService.oauthLogin.mockRejectedValue('string error');

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=Unknown%20error',
      );
    });
  });

  describe('facebookAuthCallback', () => {
    let mockRequest: RequestWithOAuthUser;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockRequest = {
        user: {
          ...mockOAuthUser,
          provider: 'facebook',
          providerId: 'facebook-123',
        },
      } as RequestWithOAuthUser;

      mockResponse = {
        redirect: jest.fn(),
      };
    });

    it('should handle successful Facebook OAuth callback', async () => {
      authService.oauthLogin.mockResolvedValue(mockOAuthLoginResponse);
      prismaService.authorizationCode.create.mockResolvedValue({
        id: 'auth-code-id',
        code: 'test-code',
        userId: 'user-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await controller.facebookAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(authService.oauthLogin).toHaveBeenCalledWith(mockRequest.user);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringMatching(/^castaway:\/\/auth\/callback\?code=.+$/),
      );
    });

    it('should redirect to error URL on failure', async () => {
      authService.oauthLogin.mockRejectedValue(
        new Error('Facebook auth failed'),
      );

      await controller.facebookAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=Facebook%20auth%20failed',
      );
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      authService.refreshTokens.mockResolvedValue(mockTokens);

      const result = await controller.refreshTokens({
        refreshToken: 'old-refresh-token',
      });

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'old-refresh-token',
      );
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Tokens refreshed successfully',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should throw error with invalid refresh token', async () => {
      authService.refreshTokens.mockRejectedValue(
        new Error('Invalid refresh token'),
      );

      await expect(
        controller.refreshTokens({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      } as RequestWithUser;

      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        message: 'Logged out successfully',
      });
    });

    it('should handle logout errors', async () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      } as RequestWithUser;

      authService.logout.mockRejectedValue(new Error('Logout failed'));

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        'Logout failed',
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user information', () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      } as RequestWithUser;

      const result = controller.getCurrentUser(mockRequest);

      expect(result).toEqual({
        statusCode: HttpStatus.OK,
        user: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      authService.exchangeAuthorizationCode.mockResolvedValue(mockTokens);

      const result = await controller.exchangeCodeForTokens({
        code: 'valid-auth-code',
      });

      expect(authService.exchangeAuthorizationCode).toHaveBeenCalledWith(
        'valid-auth-code',
      );
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should throw error with invalid authorization code', async () => {
      authService.exchangeAuthorizationCode.mockRejectedValue(
        new Error('Invalid authorization code'),
      );

      await expect(
        controller.exchangeCodeForTokens({ code: 'invalid-code' }),
      ).rejects.toThrow('Invalid authorization code');
    });
  });
});
