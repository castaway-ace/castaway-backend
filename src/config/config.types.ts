export interface StorageConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  bucketName: string;
  region: string;
  publicEndPoint: string;
  publicPort: number;
  publicUseSSL: boolean;
}
export interface AuthConfig {
  jwt: {
    secret: string;
  };
  jwtRefresh: {
    secret: string;
  };
  google: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  };
  facebook: {
    appId: string;
    appSecret: string;
    callbackURL: string;
  };
}
