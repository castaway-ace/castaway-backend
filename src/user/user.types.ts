import { Prisma } from '../generated/prisma/client.js';

export type UserWithAccounts = Prisma.UserGetPayload<{
  include: {
    accounts: true;
  };
}>;

export type UserWithAccountsAndTokens = Prisma.UserGetPayload<{
  include: {
    accounts: true;
    refreshTokens: true;
  };
}>;

export interface SyncOAuthProfileData {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface UpdateUserProfileData {
  email?: string;
  displayName?: string;
  avatarUrl?: string | null;
}
