import { Prisma } from '../generated/prisma/client.js';

export type UserCreateData = Pick<
  Prisma.UserCreateInput,
  'userName' | 'email' | 'passwordHash'
>;

export type AdminUserCreateData = Pick<
  Prisma.UserCreateInput,
  'userName' | 'email' | 'passwordHash' | 'isAdmin'
>;

export const userSelect = {
  id: true,
  email: true,
  userName: true,
  isAdmin: true,
} satisfies Prisma.UserSelect;

export const userWithPasswordSelect = {
  ...userSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

export type User = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export type UserWithPassword = Prisma.UserGetPayload<{
  select: typeof userWithPasswordSelect;
}>;
