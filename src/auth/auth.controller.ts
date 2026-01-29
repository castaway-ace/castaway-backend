import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  Logger,
  Body,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { AuthService, type OAuthUserData } from './auth.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';
import { RefreshTokenDto, type AuthResponse } from './dto/auth.dto.js';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    name: string | null;
  };
}

interface RequestWithOAuthUser extends Request {
  user: OAuthUserData;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private auth: AuthService) {}

  /**
   * Initiate Google OAuth flow
   * GET /auth/google
   */
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Guard handles the redirect to Google
  }

  /**
   * Google OAuth callback handler
   * GET /auth/google/callback
   */
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(
    @Req() req: RequestWithOAuthUser,
    @Res() res: Response,
  ) {
    await this.handleOAuthCallback(req, res, 'Google');
  }

  /**
   * Initiate Facebook OAuth flow
   * GET /auth/facebook
   */
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuth() {
    // Guard handles the redirect to Facebook
  }

  /**
   * Facebook OAuth callback handler
   * GET /auth/facebook/callback
   */
  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuthCallback(
    @Req() req: RequestWithOAuthUser,
    @Res() res: Response,
  ) {
    await this.handleOAuthCallback(req, res, 'Facebook');
  }

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   */
  @Post('refresh')
  async refreshTokens(@Body() body: RefreshTokenDto) {
    const tokens = await this.auth.refreshTokens(body.refreshToken);
    return {
      statusCode: HttpStatus.OK,
      message: 'Tokens refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout current user
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: RequestWithUser): Promise<AuthResponse> {
    await this.auth.logout(req.user.userId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Logged out successfully',
    };
  }

  /**
   * Get current user info
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@Req() req: RequestWithUser) {
    return {
      statusCode: HttpStatus.OK,
      user: req.user,
    };
  }

  private async handleOAuthCallback(
    req: RequestWithOAuthUser,
    res: Response,
    provider: string,
  ): Promise<void> {
    try {
      const result = await this.auth.oauthLogin(req.user);

      const redirectUrl = `castaway://auth/callback?access_token=${result.accessToken}&refresh_token=${result.refreshToken}`;

      res.redirect(redirectUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`${provider} auth failed: ${errorMessage}`);
      res.redirect(
        `castaway://auth/error?message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }
}
