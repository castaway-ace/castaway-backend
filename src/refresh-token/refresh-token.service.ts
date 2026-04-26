import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service.js';
import { RefreshToken } from 'src/generated/prisma/client.js';

const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_BYTES = 32;

export interface IssuedRefreshToken {
  token: string;
  record: RefreshToken;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async issue(
    userId: string,
    deviceName: string | null,
    deviceType: string | null,
  ): Promise<IssuedRefreshToken> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

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

    this.logger.log(
      `Issued refresh token: userId=${userId} tokenId=${record.id} device=${deviceName ?? 'unknown'}`,
    );

    return { token, record };
  }

  async findByToken(rawToken: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(rawToken);
    return await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async rotate(
    oldRecord: RefreshToken,
    deviceName: string | null,
    deviceType: string | null,
  ): Promise<IssuedRefreshToken> {
    const newToken = this.generateToken();
    const newTokenHash = this.hashToken(newToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    const newRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: oldRecord.userId,
          tokenHash: newTokenHash,
          deviceName,
          deviceType,
          expiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: oldRecord.id },
        data: {
          replacedById: created.id,
          revokedAt: new Date(),
        },
      });

      return created;
    });

    this.logger.log(
      `Rotated refresh token: userId=${oldRecord.userId} oldId=${oldRecord.id} newId=${newRecord.id}`,
    );

    return { token: newToken, record: newRecord };
  }


  async revokeFamilyOnReuse(userId: string, reusedTokenId: string): Promise<void> {
    this.logger.warn(
      `Refresh token reuse detected: userId=${userId} reusedTokenId=${reusedTokenId}. Revoking all user sessions.`,
    );

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Revoked all refresh tokens for userId=${userId}`);
  }

  async revokeByDevice(userId: string, deviceName: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceName, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(
      `Revoked refresh tokens for userId=${userId} device=${deviceName}`,
    );
  }

  private generateToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
