import { AuthProvider, Role } from '../generated/prisma/client.js';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface JwtVerifiedPayload extends JwtPayload {
  iat: number;
  exp: number;
}

export interface AuthProfile {
  provider: AuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface RequestWithAuthProfile extends Request {
  user: AuthProfile;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
