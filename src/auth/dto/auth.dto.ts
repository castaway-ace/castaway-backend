import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  deviceName!: string;

  @IsString()
  @IsNotEmpty()
  deviceType!: string;
}
