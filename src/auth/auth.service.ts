import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from '../generated/prisma/client.js';
import { UserRepository } from '../user/user.repository.js';
import { TokenRepository } from './token.repository.js';
import {
  JwtPayload,
  JwtVerifiedPayload,
  AuthProfile,
  Tokens,
} from './auth.types.js';
import { UserWithAccounts } from '../user/user.types.js';
import { AuthConfig } from 'src/config/config.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

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
  async resolveOAuthUser(authUser: AuthProfile): Promise<UserWithAccounts> {
    if (!authUser.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    let user = await this.userRepository.findByEmail(authUser.email);

    if (!user) {
      user = await this.userRepository.createWithAccount(authUser);
      this.logger.log(
        `New user created: ${authUser.email} via ${authUser.provider}`,
      );
    } else {
      await this.updateUserWithAccount(user, authUser);
    }

    return user;
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
  private hasAccount(
    user: UserWithAccounts,
    providerName: string,
    providerId: string,
  ): boolean {
    return user.accounts.some(
      (p) => p.provider === providerName && p.providerId === providerId,
    );
  }

  private async updateUserWithAccount(
    existingUser: UserWithAccounts,
    authUser: AuthProfile,
  ): Promise<void> {
    if (
      !this.hasAccount(existingUser, authUser.provider, authUser.providerId)
    ) {
      await this.userRepository.linkAccount(
        existingUser.id,
        authUser.provider,
        authUser.providerId,
      );
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserWithAccounts): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.username,
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
    user: UserWithAccounts,
    oldTokenId: string,
  ): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.username,
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
      const matches = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (matches) {
        return storedToken;
      }
    }
    return null;
  }
}
