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

interface RequestWithUser extends Request {
  user: GoogleUser;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Guard redirects to Google
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    const tokens = await this.authService.validateGoogleUser(req.user);

    // Option 1: Redirect to frontend with tokens in URL (less secure)
    // res.redirect(`http://localhost:3001/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);

    // Option 2: Set tokens as HTTP-only cookies (more secure)
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend
    res.redirect("http://localhost:3001/dashboard");
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