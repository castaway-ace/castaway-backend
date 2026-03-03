import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  Logger,
  Body,
} from '@nestjs/common';
import { type Response } from 'express';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';
import { RefreshTokenDto, ExchangeCodeDto } from './dto/auth.dto.js';
import { AuthService } from './auth.service.js';
import type {
  JwtPayload,
  OAuthProfile,
  RequestWithOAuthProfile,
  RequestWithUser,
  Tokens,
} from './auth.types.js';

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
  async googleAuth(): Promise<void> {
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
  ): Promise<void> {
    await this.handleOAuthCallback(req.user, res, 'Google');
  }

  /**
   * Initiate Facebook OAuth flow
   * GET /auth/facebook
   */
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuth(): Promise<void> {
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
  ): Promise<void> {
    await this.handleOAuthCallback(req.user, res, 'Facebook');
  }

  /**
   * Refresh access token using refresh token
   * POST /auth/refresh
   */
  @Post('refresh')
  async refreshTokens(@Body() body: RefreshTokenDto): Promise<Tokens> {
    return await this.auth.refreshTokens(body.refreshToken);
  }

  /**
   * Logout current user
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: RequestWithUser): Promise<void> {
    await this.auth.logout(req.user.sub);
  }

  /**
   * Get current user info from JWT payload
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@Req() req: RequestWithUser): JwtPayload {
    return req.user;
  }

  /**
   * Exchange an authorization code for access and refresh tokens
   * POST /auth/exchange
   */
  @Post('exchange')
  async exchangeCodeForTokens(@Body() dto: ExchangeCodeDto): Promise<Tokens> {
    return this.auth.exchangeAuthorizationCode(dto.code);
  }

  private async handleOAuthCallback(
    user: OAuthProfile,
    res: Response,
    provider: string,
  ): Promise<void> {
    try {
      const resolvedUser = await this.auth.resolveOAuthUser(user);
      const authCode = await this.auth.createAuthorizationCode(resolvedUser.id);

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
}
