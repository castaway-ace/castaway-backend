import {
  Account,
  Prisma,
  RefreshToken,
  User,
} from '../generated/prisma/client.js';

export type UserWithAccounts = Prisma.UserGetPayload<{
  include: {
    accounts: true;
  };
}>;

export type UserWithAccountsAndTokens = User & {
  accounts: Account[];
  refreshTokens: RefreshToken[];
};

export interface UpdateUserData {
  name?: string;
  avatar?: string;
}
