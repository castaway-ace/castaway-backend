import { Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/auth/auth.types.js';
import refreshJwtConfig from 'src/config/refresh-jwt.config.js';
import { RefreshToken } from 'src/generated/prisma/client.js';
import { PrismaService } from 'src/prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

const BCRYPT_COST = 12;
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface IssuedRefreshToken {
  token: string;
  record: RefreshToken;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
  ) {}

  async issue(
    userId: string,
    deviceName: string,
    deviceType: string,
  ): Promise<IssuedRefreshToken> {
    const payload: JwtPayload = { sub: userId, role: 'User' };
    const token = await this.jwt.signAsync(payload, this.refreshTokenConfig);
    const tokenHash = await bcrypt.hash(token, BCRYPT_COST);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceName,
        deviceType,
        expiresAt,
      },
    });

    return { token, record };
  }

  async findMatching(
    userId: string,
    rawToken: string,
  ): Promise<RefreshToken | null> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
    });

    for (const record of tokens) {
      const matches = await bcrypt.compare(rawToken, record.tokenHash);
      if (matches) {
        return record;
      }
    }

    return null;
  }

  async rotate(
    oldRecordId: string,
    userId: string,
    deviceName: string,
    deviceType: string,
  ): Promise<IssuedRefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.delete({ where: { id: oldRecordId } });

      const payload: JwtPayload = { sub: userId, role: 'User' };
      const token = await this.jwt.signAsync(payload, this.refreshTokenConfig);
      const tokenHash = await bcrypt.hash(token, BCRYPT_COST);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

      const record = await tx.refreshToken.create({
        data: {
          userId,
          tokenHash,
          deviceName,
          deviceType,
          expiresAt,
        },
      });

      return { token, record };
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    this.logger.log(`Revoked all refresh tokens for userId=${userId}`);
  }

  async revokeByDevice(userId: string, deviceName: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, deviceName },
    });
    this.logger.log(
      `Revoked refresh tokens for userId=${userId} device=${deviceName}`,
    );
  }
}
