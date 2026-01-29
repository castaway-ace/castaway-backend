import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshToken } from '../generated/prisma/client.js';

export interface CreateRefreshTokenData {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}

@Injectable()
export class TokenRepository {
  private readonly logger = new Logger(TokenRepository.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new refresh token in the database
   */
  async createRefreshToken(data: CreateRefreshTokenData): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        token: data.hashedToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Find all refresh tokens for a specific user
   */
  async findUserTokens(userId: string): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId },
    });
  }

  /**
   * Delete a specific refresh token by ID
   */
  async deleteToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { id: tokenId },
    });
  }

  /**
   * Delete all refresh tokens for a specific user (used during logout)
   */
  async deleteAllUserTokens(userId: string): Promise<void> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(
      `Deleted ${result.count} refresh token(s) for user: ${userId}`,
    );
  }

  /**
   * Rotate a refresh token (delete old, create new) within a transaction
   * This ensures atomicity and prevents race conditions
   */
  async rotateToken(
    oldTokenId: string,
    data: CreateRefreshTokenData,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete the old token
      await tx.refreshToken.delete({
        where: { id: oldTokenId },
      });

      // Create the new token
      await tx.refreshToken.create({
        data: {
          userId: data.userId,
          token: data.hashedToken,
          expiresAt: data.expiresAt,
        },
      });
    });

    this.logger.log(`Rotated refresh token for user: ${data.userId}`);
  }

  /**
   * Find an authorization code
   */
  async findAuthorizationCode(code: string) {
    return this.prisma.authorizationCode.findUnique({
      where: { code },
      include: { user: { include: { providers: true } } },
    });
  }

  /**
   * Delete an authorization code
   */
  async deleteAuthorizationCode(id: string): Promise<void> {
    await this.prisma.authorizationCode.delete({
      where: { id },
    });
  }
}
