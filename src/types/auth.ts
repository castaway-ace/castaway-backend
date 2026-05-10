export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenInput {
  deviceId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface TokenPayload {
  sub: string;
  deviceId: string;
}
