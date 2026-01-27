export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface JwtRefreshConfig {
  secret: string;
  expiresIn: string;
}

export interface GoogleOAuthConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

export interface FacebookOAuthConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

export interface AuthConfig {
  jwt: JwtConfig;
  jwtRefresh: JwtRefreshConfig;
  google: GoogleOAuthConfig;
  facebook: FacebookOAuthConfig;
}

export interface StorageConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  bucketName: string;
  region: string;
}
