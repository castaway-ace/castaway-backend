import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';
import type {
  JwtPayload,
  OAuthProfile,
  RequestWithOAuthProfile,
  RequestWithUser,
  Tokens,
} from './auth.types.js';
import { Response } from 'express';
import { UserRole } from '../generated/prisma/client.js';
import { UserWithProviders } from '../user/user.types.js';

const fixedDate = new Date('2026-02-01');

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    resolveOAuthUser: jest.Mock;
    createAuthorizationCode: jest.Mock;
    refreshTokens: jest.Mock;
    logout: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
  };

  const mockTokens: Tokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  const mockResolvedUser: UserWithProviders = {
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

  const mockGoogleOAuthProfile: OAuthProfile = {
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'google',
    providerId: 'google-123',
  };

  const mockFacebookOAuthProfile: OAuthProfile = {
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    provider: 'facebook',
    providerId: 'facebook-123',
  };

  const mockJwtPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
  };

  const mockAdminJwtPayload: JwtPayload = {
    sub: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    const mockAuthService = {
      resolveOAuthUser: jest.fn(),
      createAuthorizationCode: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('googleAuthCallback', () => {
    let mockRequest: RequestWithOAuthProfile;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockRequest = {
        user: mockGoogleOAuthProfile,
      } as unknown as RequestWithOAuthProfile;

      mockResponse = {
        redirect: jest.fn(),
      };
    });

    it('should handle successful Google OAuth callback', async () => {
      authService.resolveOAuthUser.mockResolvedValue(mockResolvedUser);
      authService.createAuthorizationCode.mockResolvedValue('mock-auth-code');

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(authService.resolveOAuthUser).toHaveBeenCalledWith(
        mockGoogleOAuthProfile,
      );
      expect(authService.createAuthorizationCode).toHaveBeenCalledWith(
        'user-123',
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/callback?code=mock-auth-code',
      );
    });

    it('should redirect to error URL on OAuth failure', async () => {
      const error = new Error('OAuth provider error');
      authService.resolveOAuthUser.mockRejectedValue(error);

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=OAuth%20provider%20error',
      );
      expect(authService.createAuthorizationCode).not.toHaveBeenCalled();
    });

    it('should redirect to error URL on authorization code creation failure', async () => {
      authService.resolveOAuthUser.mockResolvedValue(mockResolvedUser);
      authService.createAuthorizationCode.mockRejectedValue(
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
      authService.resolveOAuthUser.mockRejectedValue('string error');

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=Unknown%20error',
      );
    });

    it('should handle UnauthorizedException with appropriate message', async () => {
      const error = new Error('Error: User not authorized');
      authService.resolveOAuthUser.mockRejectedValue(error);

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=Error%3A%20User%20not%20authorized',
      );
      expect(authService.createAuthorizationCode).not.toHaveBeenCalled();
    });

    it('should handle network timeout errors', async () => {
      const error = new Error('ETIMEDOUT');
      authService.resolveOAuthUser.mockRejectedValue(error);

      await controller.googleAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/error?message=ETIMEDOUT',
      );
    });
  });

  describe('facebookAuthCallback', () => {
    let mockRequest: RequestWithOAuthProfile;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockRequest = {
        user: mockFacebookOAuthProfile,
      } as unknown as RequestWithOAuthProfile;

      mockResponse = {
        redirect: jest.fn(),
      };
    });

    it('should handle successful Facebook OAuth callback', async () => {
      authService.resolveOAuthUser.mockResolvedValue(mockResolvedUser);
      authService.createAuthorizationCode.mockResolvedValue('mock-auth-code');

      await controller.facebookAuthCallback(
        mockRequest,
        mockResponse as Response,
      );

      expect(authService.resolveOAuthUser).toHaveBeenCalledWith(
        mockFacebookOAuthProfile,
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'castaway://auth/callback?code=mock-auth-code',
      );
    });

    it('should redirect to error URL on failure', async () => {
      authService.resolveOAuthUser.mockRejectedValue(
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
      expect(result).toEqual(mockTokens);
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
        user: mockJwtPayload,
      } as unknown as RequestWithUser;

      authService.logout.mockResolvedValue(undefined);

      await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith('user-123');
    });

    it('should handle logout errors', async () => {
      const mockRequest = {
        user: mockJwtPayload,
      } as unknown as RequestWithUser;

      authService.logout.mockRejectedValue(new Error('Logout failed'));

      await expect(controller.logout(mockRequest)).rejects.toThrow(
        'Logout failed',
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return the JWT payload for the authenticated user', () => {
      const mockRequest = {
        user: mockJwtPayload,
      } as unknown as RequestWithUser;

      const result = controller.getCurrentUser(mockRequest);

      expect(result).toEqual({
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
      });
    });

    it('should return admin role for admin user', () => {
      const mockRequest = {
        user: mockAdminJwtPayload,
      } as unknown as RequestWithUser;

      const result = controller.getCurrentUser(mockRequest);

      expect(result.role).toBe(UserRole.ADMIN);
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
      expect(result).toEqual(mockTokens);
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
