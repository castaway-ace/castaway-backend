import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { DeviceInfoDto } from './device.dto.js';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @IsString()
  @MinLength(8)
  readonly password!: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @IsNotEmpty()
  readonly deviceInfo!: DeviceInfoDto;
}
