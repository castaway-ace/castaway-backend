import { Account, RefreshToken, User } from '../generated/prisma/client.js';

export type UserWithAccounts = User & {
  accounts: Account[];
};

export type UserWithAccountsAndTokens = User & {
  accounts: Account[];
  refreshTokens: RefreshToken[];
};

export interface UpdateUserData {
  name?: string;
  avatar?: string;
}
