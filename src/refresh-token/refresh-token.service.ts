import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthTokens, RefreshTokenInput, TokenPayload } from '../types/auth.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type StringValue } from 'ms';
import ms from 'ms';
import { createHash } from 'crypto';
import { UserService } from '../user/user.service.js';

interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: StringValue;
  refreshSecret: string;
  refreshExpiresIn: StringValue;
}

@Injectable()
export class RefreshTokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.loadJwtConfig(configService);
  }

  async issue(input: RefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  async rotate(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const existingRefreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { device: true },
    });

    if (!existingRefreshToken)
      throw new UnauthorizedException('Invalid refresh token');
    if (existingRefreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    if (existingRefreshToken.invalidatedAt !== null) {
      throw new UnauthorizedException('Refresh token invalidated');
    }
    if (existingRefreshToken.usedAt !== null) {
      await this.revokeFamily(existingRefreshToken.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const user = await this.userService.findById(
      existingRefreshToken.device.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const {
      accessToken,
      refreshToken: newRawRefreshToken,
      refreshExpiresAt,
    } = await this.generateTokens({
      sub: user.id,
      deviceId: existingRefreshToken.deviceId,
      isAdmin: user.isAdmin,
    });

    const newTokenHash = this.hashToken(newRawRefreshToken);

    const newToken = await this.prisma.refreshToken.create({
      data: {
        deviceId: existingRefreshToken.deviceId,
        familyId: existingRefreshToken.familyId,
        tokenHash: newTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    const updateResult = await this.prisma.refreshToken.updateMany({
      where: { id: existingRefreshToken.id, usedAt: null },
      data: {
        usedAt: new Date(),
        replacedById: newToken.id,
      },
    });

    if (updateResult.count === 0) {
      await this.revokeFamily(existingRefreshToken.familyId);
      throw new UnauthorizedException('Concurrent rotation detected');
    }

    await this.prisma.device.update({
      where: { id: existingRefreshToken.deviceId },
      data: { lastSeenAt: new Date() },
    });

    return { accessToken, refreshToken: newRawRefreshToken };
  }

  async generateTokens(
    payload: TokenPayload,
  ): Promise<AuthTokens & { refreshExpiresAt: Date }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtConfig.accessSecret,
        expiresIn: this.jwtConfig.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: this.jwtConfig.refreshExpiresIn,
      }),
    ]);

    const refreshExpiresAt = new Date(
      Date.now() + ms(this.jwtConfig.refreshExpiresIn),
    );

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async revokeByToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });

    if (!token) {
      return;
    }

    await this.revokeFamily(token.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private loadJwtConfig(configService: ConfigService): JwtConfig {
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpiresIn = configService.get<string>('JWT_ACCESS_EXPIRATION');
    const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
    );

    if (
      !accessSecret ||
      !accessExpiresIn ||
      !refreshSecret ||
      !refreshExpiresIn
    ) {
      throw new Error('JWT configuration is incomplete');
    }

    return {
      accessSecret,
      accessExpiresIn: accessExpiresIn as StringValue,
      refreshSecret,
      refreshExpiresIn: refreshExpiresIn as StringValue,
    };
  }
}
