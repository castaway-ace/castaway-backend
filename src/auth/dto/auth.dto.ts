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
