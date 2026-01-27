import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { AuthService } from './auth.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { FacebookOAuthGuard } from './guards/facebook-oauth.guard.js';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-oauth.guard.js';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    name: string | null;
  };
}

interface RequestWithOAuthUser extends Request {
  user: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    avatar: string | null;
    accessToken: string;
    refreshToken: string | null;
  };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  configService: any;

  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(
    @Req() req: RequestWithOAuthUser,
    @Res() res: Response,
  ) {
    try {
      const result = await this.auth.oauthLogin(req.user);

      // Set tokens in HTTP-only cookies
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.redirect(`/auth/success`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Google auth failed: ${errorMessage}`);
      res.redirect(`/auth/error`);
    }
  }

  /**
   * Initiate Facebook OAuth flow
   * GET /auth/facebook
   */
  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuth() {
    // Guard redirects to Facebook
  }

  /**
   * Facebook OAuth callback
   * GET /auth/facebook/callback
   */
  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  async facebookAuthCallback(
    @Req() req: RequestWithOAuthUser,
    @Res() res: Response,
  ) {
    try {
      const result = await this.auth.oauthLogin(req.user);

      // Set tokens in HTTP-only cookies
      this.setAuthCookies(res, result.accessToken, result.refreshToken);

      res.redirect(`auth/success`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Google auth failed: ${errorMessage}`);
      res.redirect(`/auth/error`);
    }
  }

  @Post('refresh')
  async refreshTokens(@Req() req: Request, @Res() res: Response) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        throw new UnauthorizedException('No refresh token provided');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const tokens = await this.auth.refreshTokens(refreshToken);

      // Set new tokens in cookies
      this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      res.json({
        statusCode: HttpStatus.OK,
        message: 'Tokens refreshed successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token refresh failed: ${errorMessage}`);

      // Clear invalid cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');

      res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid refresh token',
      });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      await this.auth.logout(req.user.userId);

      // Clear cookies
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');

      res.json({
        statusCode: HttpStatus.OK,
        message: 'Logged out successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Google auth failed: ${errorMessage}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Logout failed',
      });
    }
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

  /**
   * Helper: Set auth cookies
   */
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProduction = this.config.get('NODE_ENV') === 'production';

    // Access token cookie (15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Refresh token cookie (7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
