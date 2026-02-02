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
import { type Response } from 'express';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';
import { RefreshTokenDto, type AuthResponse } from './dto/auth.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service.js';
import type {
  OAuthProfile,
  RequestWithOAuthProfile,
  RequestWithUser,
  Tokens,
} from './auth.types.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

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
    @Req() req: RequestWithOAuthProfile,
    @Res() res: Response,
  ) {
    await this.handleOAuthCallback(req.user, res, 'Google');
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
    @Req() req: RequestWithOAuthProfile,
    @Res() res: Response,
  ) {
    await this.handleOAuthCallback(req.user, res, 'Facebook');
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
    await this.auth.logout(req.user.id);
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
  getCurrentUser(@Req() req: RequestWithOAuthProfile) {
    return {
      statusCode: HttpStatus.OK,
      user: req.user,
    };
  }

  private async handleOAuthCallback(
    user: OAuthProfile,
    res: Response,
    provider: string,
  ): Promise<void> {
    try {
      const data = await this.auth.oauthLogin(user);

      const authCode = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await this.prisma.authorizationCode.create({
        data: {
          code: authCode,
          userId: data.user.id,
          expiresAt,
        },
      });

      res.redirect(`castaway://auth/callback?code=${authCode}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`${provider} auth failed: ${errorMessage}`);
      res.redirect(
        `castaway://auth/error?message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Post('exchange')
  async exchangeCodeForTokens(@Body() dto: { code: string }): Promise<Tokens> {
    return this.auth.exchangeAuthorizationCode(dto.code);
  }
}
