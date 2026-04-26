import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SyncOAuthProfileData,
  UpdateUserProfileData,
  UserWithAccounts,
  UserWithAccountsAndTokens,
} from './user.types.js';
import { AuthProfile } from '../auth/auth.types.js';
import { AuthProvider, Role } from 'src/generated/prisma/client.js';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) { }

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
   * Find a user by their OAuth provider identity.
   */
  async findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserWithAccounts | null> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerId: { provider, providerId },
      },
      include: {
        user: {
          include: { accounts: true },
        },
      },
    });

    return account?.user ?? null;
  }

  /**
   * Create a new user with an initial OAuth account
   */
  async createWithAccount(user: AuthProfile): Promise<UserWithAccounts> {
    const { email, avatar, provider, providerId } = user;

    const createdUser = await this.prisma.user.create({
      data: {
        email,
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
   * Refresh profile fields from an OAuth provider on returning sign-in.
   */
  async syncOAuthProfile(
    userId: string,
    data: SyncOAuthProfileData,
  ): Promise<UserWithAccounts> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { accounts: true },
    });

    this.logger.log(`Synced OAuth profile for userId=${userId}`);

    return updatedUser;
  }

  /**
   * Update user-editable profile fields.
   */
  async updateProfile(
    userId: string,
    data: UpdateUserProfileData,
  ): Promise<UserWithAccounts> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { accounts: true },
    });

    this.logger.log(`Updated profile for userId=${userId}`);

    return updatedUser;
  }

    /**
     * Update a user's password
     */
    async updatePassword(userId: string, password: string): Promise<void> {
      await this.prisma.user.update({
        where: { id: userId },
        data: { password },
      });
  
      this.logger.log(`Updated password for userId=${userId}`);
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
