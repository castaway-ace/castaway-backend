import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  OAuthProvider,
  RefreshToken,
  User,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OAuthLoginResponse, UserResponse } from '../auth/dto/auth.dto.js';

export interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

type UserWithProviders = User & {
  providers: OAuthProvider[];
};

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
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('auth.jwt.secret', '');
    this.jwtRefresh = this.config.get<string>('auth.jwtRefresh.secret', '');
  }

  async oauthLogin(oauthUser: OAuthUserData): Promise<OAuthLoginResponse> {
    const { provider, providerId, email, name, avatar } = oauthUser;

    if (!email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { providers: true },
    });

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
    return await this.prisma.user.create({
      data: {
        email,
        name,
        avatar,
        providers: {
          create: {
            provider,
            providerId,
          },
        },
      },
      include: { providers: true },
    });
  }

  private async updateUserAndProvider(
    user: UserWithProviders,
    provider: string,
    providerId: string,
    name: string,
    avatar: string | null,
  ): Promise<void> {
    const existingProvider = user.providers.find(
      (p) => p.provider === provider && p.providerId === providerId,
    );

    if (!existingProvider) {
      await this.prisma.oAuthProvider.create({
        data: {
          userId: user.id,
          provider,
          providerId,
        },
      });

      this.logger.log(`Linked ${provider} account to user: ${user.email}`);
    }

    if (name || avatar) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name && { name }),
          ...(avatar && { avatar }),
        },
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

    const hashedToken = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    const payload = await this.jwt.verifyAsync<JwtVerifiedPayload>(
      refreshToken,
      {
        secret: this.jwtRefresh,
      },
    );

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { refreshTokens: true, providers: true },
    });

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
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    return await this.rotateRefreshToken(user, storedToken.id);
  }

  private async rotateRefreshToken(
    user: UserWithProviders,
    oldTokenId: string,
  ): Promise<Tokens> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({
        where: { id: oldTokenId },
      });

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

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt,
        },
      });

      return { accessToken, refreshToken };
    });
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
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`User logged out: ${userId}`, { userId });
  }

  async exchangeAuthorizationCode(code: string): Promise<Tokens> {
    const authCode = await this.prisma.authorizationCode.findUnique({
      where: { code },
      include: { user: { include: { providers: true } } },
    });

    if (!authCode || authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    // Delete the code immediately (single use)
    await this.prisma.authorizationCode.delete({
      where: { id: authCode.id },
    });

    // Generate and return tokens
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
}
