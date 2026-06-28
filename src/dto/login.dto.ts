import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  ValidateNested,
  IsEmail,
  Matches,
} from 'class-validator';
import { DeviceDto } from '../device/dto/device.dto.js';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
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

  @ApiProperty({ type: () => DeviceDto })
  @ValidateNested()
  @Type(() => DeviceDto)
  @IsNotEmpty()
  readonly deviceInfo!: DeviceDto;
}
