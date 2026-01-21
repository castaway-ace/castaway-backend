import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface CreateUserFromOAuthParams {
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    provider: string;
    providerAccountId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    idToken?: string;
  }

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { accounts: true },
    });
  }

  async findOrCreateFromOAuth(params: CreateUserFromOAuthParams) {
    const {
      email,
      firstName,
      lastName,
      avatar,
      provider,
      providerAccountId,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      idToken,
    } = params;

    console.log('Finding or creating user for:', { email, provider });

    // Try to find existing user by email
    let user = await this.findByEmail(email);

    if (user) {
      console.log('User found by email:', user.id);
      
      // User exists, check if this OAuth account is already linked
      const existingAccount = user.accounts.find(
        (account) => account.provider === provider && account.providerAccountId === providerAccountId
      );

      if (existingAccount) {
        console.log('OAuth account already linked, updating tokens');
        
        // OAuth account already linked, update tokens
        await this.prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            accessToken,
            refreshToken,
            expiresAt,
            scope,
            idToken,
            updatedAt: new Date(),
          },
        });
      } else {
        console.log('Linking new OAuth provider to existing user');
        
        // User exists but this OAuth provider is not linked yet, link it
        await this.prisma.account.create({
          data: {
            userId: user.id,
            provider,
            providerAccountId,
            accessToken,
            refreshToken,
            expiresAt,
            scope,
            idToken,
          },
        });
      }

      // Update user profile if new information is provided
      const updateData: any = {};
      if (firstName && !user.firstName) updateData.firstName = firstName;
      if (lastName && !user.lastName) updateData.lastName = lastName;
      if (avatar && !user.avatar) updateData.avatar = avatar;

      if (Object.keys(updateData).length > 0) {
        console.log('Updating user profile:', updateData);
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { accounts: true },
        });
      } else {
        // Refresh user data to include the new account
        user = await this.findById(user.id);
      }
    } else {
      console.log('Creating new user with OAuth account');
      
      // User does not exist, create new user with OAuth account
      user = await this.prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          accounts: {
            create: {
              provider,
              providerAccountId,
              accessToken,
              refreshToken,
              expiresAt,
              scope,
              idToken,
            },
          },
        },
        include: { accounts: true },
      });
    }

    console.log('Final user state:', {
      userId: user?.id,
      email: user?.email,
      linkedProviders: user?.accounts.map(acc => acc.provider),
    });

    return user;
  }

  async updateAccountTokens(
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: number,
  ) {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (account) {
      return this.prisma.account.update({
        where: { id: account.id },
        data: {
          accessToken,
          refreshToken,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    return null;
  }
}