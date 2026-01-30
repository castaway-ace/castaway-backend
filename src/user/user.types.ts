import {
  OAuthProvider,
  RefreshToken,
  User,
} from '../generated/prisma/client.js';

export type UserWithProviders = User & {
  providers: OAuthProvider[];
};

export type UserWithProvidersAndTokens = User & {
  providers: OAuthProvider[];
  refreshTokens: RefreshToken[];
};

export interface CreateUserWithProviderData {
  email: string;
  name: string;
  avatar: string | null;
  provider: string;
  providerId: string;
}

export interface UpdateUserData {
  name?: string;
  avatar?: string;
}
