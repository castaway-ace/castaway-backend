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
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly userName!: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a number' })
  readonly password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  readonly referralCode!: string;

  @ApiProperty({ type: () => DeviceInfoDto })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @IsNotEmpty()
  readonly deviceInfo!: DeviceInfoDto;
}
