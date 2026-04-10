import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UpdateUserData,
  UserWithAccounts,
  UserWithAccountsAndTokens,
} from './user.types.js';
import { AuthProfile } from '../auth/auth.types.js';
import { AuthProvider } from 'src/generated/prisma/client.js';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by email with their OAuth accounts
   */
  async findByEmail(email: string): Promise<UserWithAccounts | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });
  }

  /**
   * Find a user by ID with their OAuth accounts and refresh tokens
   */
  async findByIdWithTokens(
    id: string,
  ): Promise<UserWithAccountsAndTokens | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        accounts: true,
        refreshTokens: true,
      },
    });
  }

  /**
   * Find a user by ID with only OAuth accounts (no tokens)
   */
  async findByIdWithAccounts(id: string): Promise<UserWithAccounts | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { accounts: true },
    });
  }

  /**
   * Create a new user with an initial OAuth account
   */
  async createWithAccount(user: AuthProfile): Promise<UserWithAccounts> {
    const { email, name, avatar, provider, providerId } = user;

    const createdUser = await this.prisma.user.create({
      data: {
        email,
        username: name,
        avatarUrl: avatar,
        accounts: {
          create: {
            provider: provider,
            providerId,
          },
        },
      },
      include: { accounts: true },
    });

    this.logger.log(`Created new user: ${email} via ${provider}`);

    return createdUser;
  }

  /**
   * Update user profile information
   */
  async updateUser(userId: string, data: UpdateUserData): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Link an OAuth provider to an existing user
   */
  async linkAccount(
    userId: string,
    provider: AuthProvider,
    providerId: string,
  ): Promise<void> {
    await this.prisma.account.create({
      data: {
        userId,
        provider,
        providerId,
      },
    });

    this.logger.log(
      `Linked ${provider} account to user ID: ${userId} with provider ID: ${providerId}`,
    );
  }
}
