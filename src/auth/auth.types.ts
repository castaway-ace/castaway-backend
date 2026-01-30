export interface OAuthUserData {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string | null;
}

export interface JwtVerifiedPayload extends JwtPayload {
  iat: number;
  exp: number;
}

export interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    name: string | null;
  };
}

export interface RequestWithOAuthUser extends Request {
  user: OAuthUserData;
}
