import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  ValidateNested,
  Matches,
} from 'class-validator';
import { DeviceInfoDto } from './device.dto.js';

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  readonly userName!: string;

  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsString()
  @MinLength(12)
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a number' })
  readonly password!: string;

  @IsString()
  @MinLength(8)
  readonly referralCode!: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @IsNotEmpty()
  readonly deviceInfo!: DeviceInfoDto;
}
