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

interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async oauthLogin(oauthUser: OAuthUserData) {
    try {
      const {
        provider,
        providerId,
        email,
        name,
        avatar,
        accessToken,
        refreshToken,
      } = oauthUser;

      if (!email) {
        throw new UnauthorizedException('Email not provided by OAuth provider');
      }

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: { providers: true },
      });

      if (!user) {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            avatar,
            providers: {
              create: {
                provider,
                providerId,
                accessToken,
                refreshToken,
              },
            },
          },
          include: { providers: true },
        });

        this.logger.log(`New user created: ${email} via ${provider}`);
      } else {
        // Check if this provider is already linked
        const existingProvider = user.providers.find(
          (p) => p.provider === provider && p.providerId === providerId,
        );

        if (!existingProvider) {
          // Link new provider to existing user
          await this.prisma.oAuthProvider.create({
            data: {
              userId: user.id,
              provider,
              providerId,
              accessToken,
              refreshToken,
            },
          });

          this.logger.log(`Linked ${provider} account to user: ${email}`);
        } else {
          // Update existing provider tokens
          await this.prisma.oAuthProvider.update({
            where: { id: existingProvider.id },
            data: {
              accessToken,
              refreshToken,
            },
          });

          this.logger.log(`Updated ${provider} tokens for user: ${email}`);
        }

        // Update user info if changed
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: name || user.name,

            avatar: avatar || user.avatar,
          },
        });
      }

      // Generate JWT tokens
      const tokens = await this.generateTokens(user);

      return {
        user: {
          id: user.id,

          email: user.email,

          name: user.name,

          avatar: user.avatar,
        },
        ...tokens,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`OAuth login failed: ${errorMessage}`);
      throw error;
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
        expiresIn: '15m',
        secret: process.env.JWT_SECRET,
      }),

      this.jwt.signAsync(payload, {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const hashedToken = await bcrypt.hash(refreshToken, 10);

    // Calculate expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        token: hashedToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<Tokens> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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

      const tokens = await this.generateTokens(user);

      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      return tokens;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token refresh failed: ${errorMessage}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findMatchingToken(
    refreshToken: string,
    tokens: RefreshToken[],
  ): Promise<RefreshToken | null> {
    for (const storedToken of tokens) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    this.logger.log(`User logged out: ${userId}`);
  }
}
