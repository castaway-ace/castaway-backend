import { UserRole } from 'src/generated/prisma/enums.js';
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

export interface RequestWithUser extends Request {
  user: UserWithProviders;
}

export interface OAuthLoginResponse {
  user: UserWithProviders;
  tokens: Tokens;
}
