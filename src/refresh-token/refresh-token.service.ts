import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { type StringValue } from 'ms';
import ms from 'ms';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service.js';
import { AuthTokensEntity } from '../auth/entities/auth-tokens.entity.js';
import { TokenPayload } from './refresh-token.types.js';
import { WhitelistService } from '../whitelist/whitelist.service.js';
import { Role } from '../generated/prisma/client.js';

interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: StringValue;
  accessExpiresInMs: number;
  refreshExpiresIn: StringValue;
  refreshExpiresInMs: number;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const INVALIDATED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService,
    private readonly whitelistService: WhitelistService,
  ) {
    this.jwtConfig = this.loadJwtConfig(configService);
  }

  async rotate(rawRefreshToken: string): Promise<AuthTokensEntity> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const existingRefreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { device: true },
    });

    if (!existingRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existingRefreshToken.invalidatedAt !== null) {
      throw new UnauthorizedException('Refresh token invalidated');
    }

    if (existingRefreshToken.usedAt !== null) {
      await this.revokeFamily(existingRefreshToken.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existingRefreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userService.findById(
      existingRefreshToken.device.userId,
    );

    if (
      !user.roles.includes(Role.ADMIN) &&
      !(await this.whitelistService.isWhitelisted(user.email))
    ) {
      throw new UnauthorizedException('Access has been revoked');
    }

    const issued = await this.generateTokens({
      sub: user.id,
      deviceId: existingRefreshToken.deviceId,
      isAdmin: user.isAdmin,
      roles: user.roles,
    });

    const newTokenHash = this.hashToken(issued.refreshToken);

    const claimed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.refreshToken.updateMany({
        where: {
          id: existingRefreshToken.id,
          usedAt: null,
          invalidatedAt: null,
        },
        data: { usedAt: new Date() },
      });

      if (claim.count === 0) {
        return false;
      }

      const newToken = await tx.refreshToken.create({
        data: {
          deviceId: existingRefreshToken.deviceId,
          familyId: existingRefreshToken.familyId,
          tokenHash: newTokenHash,
          expiresAt: issued.refreshExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: existingRefreshToken.id },
        data: { replacedById: newToken.id },
      });

      await tx.device.update({
        where: { id: existingRefreshToken.deviceId },
        data: { lastSeenAt: new Date() },
      });

      return true;
    });

    if (!claimed) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
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

  async revokeSessionsForUser(userId: string): Promise<void> {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      select: { id: true },
    });

    if (devices.length === 0) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        deviceId: { in: devices.map((device) => device.id) },
        invalidatedAt: null,
      },
      data: { invalidatedAt: new Date() },
    });
  }

  async issueForDevice(payload: TokenPayload): Promise<AuthTokensEntity> {
    const issued = await this.generateTokens(payload);

    await this.prisma.refreshToken.create({
      data: {
        deviceId: payload.deviceId,
        familyId: randomUUID(),
        tokenHash: this.hashToken(issued.refreshToken),
        expiresAt: issued.refreshExpiresAt,
      },
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }

  private async generateTokens(payload: TokenPayload): Promise<IssuedTokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiresIn,
    });

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(
      Date.now() + this.jwtConfig.refreshExpiresInMs,
    );

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneExpiredTokens(): Promise<number> {
    const now = new Date();
    const invalidatedCutoff = new Date(
      now.getTime() - INVALIDATED_RETENTION_MS,
    );

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { invalidatedAt: { lt: invalidatedCutoff } },
        ],
      },
    });

    if (count > 0) {
      this.logger.log(`Pruned ${count} stale refresh token(s)`);
    }

    return count;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private loadJwtConfig(configService: ConfigService): JwtConfig {
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpiresIn = configService.get<string>('JWT_ACCESS_EXPIRATION');
    const refreshExpiresIn = configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
    );

    if (!accessSecret || !accessExpiresIn || !refreshExpiresIn) {
      throw new Error('JWT configuration is incomplete');
    }

    const accessExpiresInMs = ms(accessExpiresIn as StringValue);
    const refreshExpiresInMs = ms(refreshExpiresIn as StringValue);

    if (!Number.isFinite(accessExpiresInMs) || accessExpiresInMs <= 0) {
      throw new Error(
        `JWT_ACCESS_EXPIRATION is not a valid duration: ${accessExpiresIn}`,
      );
    }

    if (!Number.isFinite(refreshExpiresInMs) || refreshExpiresInMs <= 0) {
      throw new Error(
        `JWT_REFRESH_EXPIRATION is not a valid duration: ${refreshExpiresIn}`,
      );
    }

    return {
      accessSecret,
      accessExpiresIn: accessExpiresIn as StringValue,
      accessExpiresInMs,
      refreshExpiresIn: refreshExpiresIn as StringValue,
      refreshExpiresInMs,
    };
  }
}
