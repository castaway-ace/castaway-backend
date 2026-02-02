import { User, UserRole } from '../generated/prisma/client.js';
import { UserWithProviders } from '../user/user.types.js';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface JwtVerifiedPayload extends JwtPayload {
  iat: number;
  exp: number;
}

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface RequestWithOAuthProfile extends Request {
  user: OAuthProfile;
}

export interface RequestWithUser extends Request {
  user: User;
}

export interface OAuthLoginResponse {
  user: UserWithProviders;
  tokens: Tokens;
}
