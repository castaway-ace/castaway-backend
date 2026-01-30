import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RefreshToken, User } from '../generated/prisma/client.js';
import { OAuthLoginResponse, UserResponse } from '../auth/dto/auth.dto.js';
import { UserRepository, UserWithProviders } from '../user/user.repository.js';
import { TokenRepository } from './token.repository.js';

export interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string | null;
}

interface JwtVerifiedPayload extends JwtPayload {
  iat: number;
  exp: number;
}

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

  async oauthLogin(oauthUser: OAuthUserData): Promise<OAuthLoginResponse> {
    const { provider, providerId, email, name, avatar } = oauthUser;

    if (!email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    this.validateEmailAccess(email);

    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      user = await this.createUserWithProvider(
        email,
        name,
        avatar,
        provider,
        providerId,
      );

      this.logger.log(`New user created: ${email} via ${provider}`);
    } else {
      await this.updateUserAndProvider(
        user,
        provider,
        providerId,
        name,
        avatar,
      );
    }
    const tokens = await this.generateTokens(user);

    return {
      user: this.mapUserResponse(user),
      ...tokens,
    };
  }

  private async createUserWithProvider(
    email: string,
    name: string,
    avatar: string | null,
    provider: string,
    providerId: string,
  ): Promise<UserWithProviders> {
    return this.userRepository.createWithProvider({
      email,
      name,
      avatar,
      provider,
      providerId,
    });
  }

  private async updateUserAndProvider(
    user: UserWithProviders,
    provider: string,
    providerId: string,
    name: string,
    avatar: string | null,
  ): Promise<void> {
    const hasProvider = this.userRepository.hasProvider(
      user,
      provider,
      providerId,
    );

    if (!hasProvider) {
      await this.userRepository.linkProvider(user.id, provider, providerId);
    }

    if (name || avatar) {
      await this.userRepository.updateUser(user.id, {
        ...(name && { name }),
        ...(avatar && { avatar }),
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

  private mapUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };
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
