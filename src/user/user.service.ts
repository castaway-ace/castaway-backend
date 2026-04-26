import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AuthProfile } from 'src/auth/auth.types.js';
import { UserWithAccounts } from './user.types.js';
import { AuthProvider, Role } from 'src/generated/prisma/client.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly userRepository: UserRepository
  ) {}

  async findById(id: string): Promise<UserWithAccounts | null> {
    return await this.userRepository.findByIdWithAccounts(id);
  }

  async findByEmail(email: string): Promise<UserWithAccounts | null> {
    return await this.userRepository.findByEmail(email);
  }

  async findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserWithAccounts | null> {
    return await this.userRepository.findByProvider(provider, providerId);
  }

  async createWithAccount(authUser: AuthProfile): Promise<UserWithAccounts> {
    try {
      return await this.userRepository.createWithAccount(authUser);
    } catch (error) {
      this.logger.error(
        `Failed to create OAuth user: email=${authUser.email} provider=${authUser.provider}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Unable to complete sign in. Please try again.',
      );
    }
  }

  async linkAccount(
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

    try {
      await this.userRepository.linkAccount(user.id, provider, providerId);
    } catch (error) {
      this.logger.error(
        `Failed to link OAuth provider: userId=${user.id} email=${email} provider=${provider}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Unable to complete sign in. Please try again.',
      );
    }

    const refreshed = await this.userRepository.findByIdWithAccounts(user.id);
    if (refreshed === null) {
      this.logger.error(
        `User vanished after linking provider: userId=${user.id}`,
      );
      throw new InternalServerErrorException(
        'Unable to complete sign in. Please try again.',
      );
    }
    return refreshed;
  }

  // TODO: Move to token.service.ts
  // async updateHashedRefreshToken(
  //   refreshTokenId: string,
  //   hashedRefreshToken: string,
  // ): Promise<RefreshToken> {
  //   return await this.prisma.refreshToken.update({
  //     where: { id: refreshTokenId },
  //     data: {
  //       tokenHash: hashedRefreshToken,
  //     },
  //   });
  // }

  // async findRefreshTokens(userId: string): Promise<RefreshToken[]> {
  //   return await this.prisma.refreshToken.findMany({
  //     where: { userId },
  //   });
  // }

  // async deleteAllUserTokens(userId: string, deviceName: string): Promise<void> {
  //   await this.prisma.refreshToken.deleteMany({
  //     where: { userId, deviceName },
  //   });
  // }
}
