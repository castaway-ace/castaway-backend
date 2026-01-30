import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateUserWithProviderData,
  UpdateUserData,
  UserWithProviders,
  UserWithProvidersAndTokens,
} from './user.types.js';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by email with their OAuth providers
   */
  async findByEmail(email: string): Promise<UserWithProviders | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { providers: true },
    });
  }

  /**
   * Find a user by ID with their OAuth providers and refresh tokens
   */
  async findById(id: string): Promise<UserWithProvidersAndTokens | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        providers: true,
        refreshTokens: true,
      },
    });
  }

  /**
   * Find a user by ID with only OAuth providers (no tokens)
   */
  async findByIdWithProviders(id: string): Promise<UserWithProviders | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { providers: true },
    });
  }

  /**
   * Create a new user with an initial OAuth provider
   */
  async createWithProvider(
    data: CreateUserWithProviderData,
  ): Promise<UserWithProviders> {
    const { email, name, avatar, provider, providerId } = data;

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        avatar,
        providers: {
          create: {
            provider,
            providerId,
          },
        },
      },
      include: { providers: true },
    });

    this.logger.log(`Created new user: ${email} via ${provider}`);

    return user;
  }

  /**
   * Update user profile information
   */
  async updateUser(userId: string, data: UpdateUserData): Promise<void> {
    const updateData: Record<string, string> = {};

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.avatar) {
      updateData.avatar = data.avatar;
    }

    // Only update if there is data to update
    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }
  }

  /**
   * Link an OAuth provider to an existing user
   */
  async linkProvider(
    userId: string,
    provider: string,
    providerId: string,
  ): Promise<void> {
    await this.prisma.oAuthProvider.create({
      data: {
        userId,
        provider,
        providerId,
      },
    });

    this.logger.log(`Linked ${provider} account to user ID: ${userId}`);
  }

  /**
   * Check if a user already has a specific OAuth provider linked
   */
  hasProvider(
    user: UserWithProviders,
    provider: string,
    providerId: string,
  ): boolean {
    return user.providers.some(
      (p) => p.provider === provider && p.providerId === providerId,
    );
  }
}
