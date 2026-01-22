import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { type Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { GoogleUser } from "./strategies/google.strategy";
import { FacebookAuthGuard } from "./guards/facebook-auth.guard";
import { FacebookUser } from "./strategies/facebook.strategy";

interface RequestWithGoogleUser extends Request {
  user: GoogleUser;
}

interface RequestWithFacebookUser extends Request {
  user: FacebookUser;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) { }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: RequestWithGoogleUser,
    @Res() res: Response
  ) {
    const tokens = await this.authService.validateOAuthUser(req.user);

    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("http://localhost:3000");
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebookAuth() {
    // Guard redirects to Facebook
  }

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  async facebookAuthCallback(
    @Req() req: RequestWithFacebookUser,
    @Res() res: Response
  ) {
    const tokens = await this.authService.validateOAuthUser(req.user);

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });


    res.redirect('http://localhost:3000');
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { userId: string; refreshToken: string }) {
    await this.authService.logout(body.userId, body.refreshToken);
    return { message: "Logged out successfully" };
  }
}