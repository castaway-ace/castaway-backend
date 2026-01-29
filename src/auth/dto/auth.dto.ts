import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export interface AuthResponse<T = unknown> {
  statusCode: number;
  message: string;
  data?: T;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface OAuthLoginResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}
