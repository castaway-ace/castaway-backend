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
  OAuthLoginResponse,
  Tokens,
} from './auth.types.js';
import { UserWithProviders } from '../user/user.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefresh: string;
  private readonly allowedEmails: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    private jwt: JwtService,
    private readonly userRepository: UserRepository,
    private readonly tokenRepository: TokenRepository,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('auth.jwt.secret', '');
    this.jwtRefresh = this.config.get<string>('auth.jwtRefresh.secret', '');
    this.allowedEmails = this.config.get<string>('auth.allowedEmails', '');
  }

  async oauthLogin(oauthUser: UserWithProviders): Promise<OAuthLoginResponse> {
    if (!oauthUser.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    this.validateEmailAccess(oauthUser.email);

    let user = await this.userRepository.findByEmail(oauthUser.email);

    if (!user) {
      user = await this.createUserWithProvider(oauthUser);

      this.logger.log(
        `New user created: ${oauthUser.email} via ${oauthUser.providers[0].name}`,
      );
    } else {
      await this.updateUserAndProvider(user, oauthUser);
    }
    const tokens = await this.generateTokens(user);

    return {
      user,
      tokens,
    };
  }

  private async createUserWithProvider(
    user: UserWithProviders,
  ): Promise<UserWithProviders> {
    return this.userRepository.createWithProvider(user);
  }

  private async updateUserAndProvider(
    existingUser: UserWithProviders,
    oauthUser: UserWithProviders,
  ): Promise<void> {
    const incomingProvider = oauthUser.providers[0];
    const hasProvider = this.userRepository.hasProvider(
      existingUser,
      incomingProvider.name as string,
      incomingProvider.providerId,
    );

    if (!hasProvider) {
      await this.userRepository.linkProvider(
        existingUser.id,
        incomingProvider.name as string,
        incomingProvider.providerId,
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
        secret: this.jwtRefresh,
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

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    let payload: JwtVerifiedPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtVerifiedPayload>(refreshToken, {
        secret: this.jwtRefresh,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(payload.sub);

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
        secret: this.jwtRefresh,
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

  async logout(userId: string) {
    await this.tokenRepository.deleteAllUserTokens(userId);
    this.logger.log(`User logged out: ${userId}`, { userId });
  }

  async exchangeAuthorizationCode(code: string): Promise<Tokens> {
    const authCode = await this.tokenRepository.findAuthorizationCode(code);

    if (!authCode || authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    await this.tokenRepository.deleteAuthorizationCode(authCode.id);

    return this.generateTokens(authCode.user);
  }

  private validateEmailAccess(email: string): void {
    const allowedEmails = this.allowedEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length === 0) {
      this.logger.warn(
        'No allowed emails configured. Denying access by default.',
      );
      throw new UnauthorizedException(
        'Access control not configured. Please contact the administrator.',
      );
    }

    if (!allowedEmails.includes(email.toLowerCase())) {
      this.logger.warn(`Access denied for unauthorized email: ${email}`);
      throw new UnauthorizedException(
        'Access denied. This application is private.',
      );
    }

    this.logger.log(`Access granted for whitelisted email: ${email}`);
  }
}
