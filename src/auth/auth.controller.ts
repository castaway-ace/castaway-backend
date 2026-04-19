import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { type Response, type Request } from 'express';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthService } from './auth.service.js';
import type { RequestWithAuthProfile, RequestWithUser } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Req() req: Request) {
    return this.authService.login(req.user.id);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  refreshToken(@Req() req: Request) {
    return this.authService.refreshToken(req.user.id);
  }

  /**
   * Initiate Google OAuth flow
   * GET /auth/google
   */
  @Public()
  @Get('google/login')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(): Promise<void> {
    // Guard handles the redirect to Google
  }

  /**
   * Google OAuth callback handler
   * GET /auth/google/callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(
    @Req() req: RequestWithAuthProfile,
    @Res() res: Response,
  ): Promise<void> {
    await this.auth.handleOAuthCallback(req.user, res, 'Google');
  }

  /**
   * Initiate Facebook OAuth flow
   * GET /auth/facebook
   */
  @Public()
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuth(): Promise<void> {
    // Guard handles the redirect to Facebook
  }

  /**
   * Facebook OAuth callback handler
   * GET /auth/facebook/callback
   */
  @Public()
  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuthCallback(
    @Req() req: RequestWithAuthProfile,
    @Res() res: Response,
  ): Promise<void> {
    await this.auth.handleOAuthCallback(req.user, res, 'Facebook');
  }

  /**
   * Logout current user
   * POST /auth/logout
   */
  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: RequestWithUser): Promise<void> {
    await this.auth.logout(req.user.sub);
  }
}
