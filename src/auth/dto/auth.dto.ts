import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
