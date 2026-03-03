import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { RefreshToken } from '../generated/prisma/client.js';
import { UserRepository } from '../user/user.repository.js';
import { TokenRepository } from './token.repository.js';
import {
  JwtPayload,
  JwtVerifiedPayload,
  OAuthProfile,
  Tokens,
} from './auth.types.js';
import { UserWithProviders } from '../user/user.types.js';
import { AuthConfig } from 'src/config/config.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;
  private readonly AUTH_CODE_EXPIRY = 5 * 60 * 1000;

  constructor(
    private jwt: JwtService,
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly config: ConfigService,
  ) {
    const authConfig = this.config.get<AuthConfig>('auth');
    if (!authConfig) {
      throw new Error('Auth configuration not found');
    }

    this.jwtSecret = authConfig.jwt.secret;
    this.jwtRefreshSecret = authConfig.jwtRefresh.secret;
  }

  /**
   * Resolve an OAuth profile into a user record.
   * Creates the user if they do not exist, or updates the existing user
   * with any new provider links or profile information.
   */
  async resolveOAuthUser(oauthUser: OAuthProfile): Promise<UserWithProviders> {
    if (!oauthUser.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    let user = await this.userRepository.findByEmail(oauthUser.email);

    if (!user) {
      user = await this.userRepository.createWithProvider(oauthUser);
      this.logger.log(
        `New user created: ${oauthUser.email} via ${oauthUser.provider}`,
      );
    } else {
      await this.updateUserAndProvider(user, oauthUser);
    }

    return user;
  }

  /**
   * Create a short-lived authorization code for a user.
   * Used in the OAuth redirect flow so the mobile app can exchange
   * the code for tokens in a separate request.
   */
  async createAuthorizationCode(userId: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.AUTH_CODE_EXPIRY);

    await this.tokenRepository.createAuthorizationCode({
      code,
      userId,
      expiresAt,
    });

    return code;
  }

  /**
   * Exchange an authorization code for access and refresh tokens.
   */
  async exchangeAuthorizationCode(code: string): Promise<Tokens> {
    const authCode = await this.tokenRepository.findAuthorizationCode(code);

    if (!authCode || authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    await this.tokenRepository.deleteAuthorizationCode(authCode.id);

    return this.generateTokens(authCode.user);
  }

  /**
   * Refresh access and refresh tokens using a valid refresh token.
   * Implements token rotation: the old token is deleted and a new one is issued.
   */
  async refreshTokens(refreshToken: string): Promise<Tokens> {
    let payload: JwtVerifiedPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtVerifiedPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findByIdWithTokens(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const storedToken = await this.findMatchingToken(
      refreshToken,
      user.refreshTokens,
    );

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await this.tokenRepository.deleteToken(storedToken.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    return await this.rotateRefreshToken(user, storedToken.id);
  }

  /**
   * Logout a user by deleting all of their refresh tokens.
   */
  async logout(userId: string): Promise<void> {
    await this.tokenRepository.deleteAllUserTokens(userId);
    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Check if a user already has a specific OAuth provider linked.
   */
  private hasProvider(
    user: UserWithProviders,
    providerName: string,
    providerId: string,
  ): boolean {
    return user.providers.some(
      (p) => p.name === providerName && p.providerId === providerId,
    );
  }

  private async updateUserAndProvider(
    existingUser: UserWithProviders,
    oauthUser: OAuthProfile,
  ): Promise<void> {
    if (
      !this.hasProvider(existingUser, oauthUser.provider, oauthUser.providerId)
    ) {
      await this.userRepository.linkProvider(
        existingUser.id,
        oauthUser.provider,
        oauthUser.providerId,
      );
    }

    if (oauthUser.name || oauthUser.avatar) {
      await this.userRepository.updateUser(existingUser.id, {
        ...(oauthUser.name && { name: oauthUser.name }),
        ...(oauthUser.avatar && { avatar: oauthUser.avatar }),
      });
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserWithProviders): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        secret: this.jwtSecret,
      }),

      this.jwt.signAsync(payload, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        secret: this.jwtRefreshSecret,
      }),
    ]);

    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedToken = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.tokenRepository.createRefreshToken({
      userId,
      hashedToken,
      expiresAt,
    });
  }

  private async rotateRefreshToken(
    user: UserWithProviders,
    oldTokenId: string,
  ): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        secret: this.jwtSecret,
      }),

      this.jwt.signAsync(payload, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        secret: this.jwtRefreshSecret,
      }),
    ]);

    const hashedToken = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.tokenRepository.rotateToken(oldTokenId, {
      userId: user.id,
      hashedToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private async findMatchingToken(
    refreshToken: string,
    tokens: RefreshToken[],
  ): Promise<RefreshToken | null> {
    for (const storedToken of tokens) {
      const matches = await bcrypt.compare(refreshToken, storedToken.token);
      if (matches) {
        return storedToken;
      }
    }
    return null;
  }
}
