import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AuthProfile } from 'src/auth/auth.types.js';
import { PrismaService } from 'src/prisma/prisma.service.js';
import { UserWithAccounts } from './user.types.js';
import { RefreshToken } from 'src/generated/prisma/client.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithAccounts | null> {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
      },
    });
  }

  async createNewOAuthUser(authUser: AuthProfile): Promise<UserWithAccounts> {
    const { email, avatar, provider, providerId } = authUser;

    try {
      const createdUser = await this.prisma.user.create({
        data: {
          email,
          avatarUrl: avatar,
          accounts: {
            create: {
              provider,
              providerId,
            },
          },
        },
        include: { accounts: true },
      });
      this.logger.log(`Created new user: ${email} via ${provider}`);
      return createdUser;
    } catch (error) {
      this.logger.error(
        `Failed to create OAuth user: email=${email} provider=${provider}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Unable to complete sign in. Please try again.',
      );
    }
  }

  async linkProviderToExistingUser(
    user: UserWithAccounts,
    authUser: AuthProfile,
  ): Promise<UserWithAccounts> {
    const { provider, providerId, email } = authUser;

    const alreadyLinked = user.accounts.some(
      (account) =>
        account.provider === provider && account.providerId === providerId,
    );

    if (alreadyLinked) {
      return user;
    }

    const userId = user.id;

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          accounts: {
            create: { provider, providerId },
          },
        },
        include: { accounts: true },
      });
      this.logger.log(
        `Linked ${provider} account to userId=${userId} providerId=${providerId}`,
      );
      return updatedUser;
    } catch (error) {
      this.logger.error(
        `Failed to link OAuth provider: userId=${userId} email=${email} provider=${provider}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Unable to complete sign in. Please try again.',
      );
    }
  }

  async updateHashedRefreshToken(
    refreshTokenId: string,
    hashedRefreshToken: string,
  ): Promise<RefreshToken> {
    return await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: {
        tokenHash: hashedRefreshToken,
      },
    });
  }

  async findRefreshTokens(userId: string): Promise<RefreshToken[]> {
    return await this.prisma.refreshToken.findMany({
      where: { userId },
    });
  }

  async deleteAllUserTokens(userId: string, deviceName: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, deviceName },
    });
  }
}
