import { UserRole } from '../generated/prisma/client.js';

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
  user: JwtPayload;
}
