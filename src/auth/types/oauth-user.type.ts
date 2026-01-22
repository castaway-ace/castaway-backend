export interface BaseOAuthUser {
    provider: string;
    providerId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }
  
  export interface GoogleUser extends BaseOAuthUser {
    provider: "google";
    refreshToken: string | undefined;
  }
  
  export interface FacebookUser extends BaseOAuthUser {
    provider: "facebook";
  }
  
  export type OAuthUser = GoogleUser | FacebookUser;