import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  ValidateNested,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceDto } from '../../device/dto/device.dto.js';

export class SignUpDto {
  @ApiProperty({ minLength: 1, maxLength: 32 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  readonly userName!: string;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  readonly email!: string;

  @ApiProperty({ format: 'password', minLength: 12 })
  @IsString()
  @MinLength(12)
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a number' })
  readonly password!: string;

  @ApiProperty({ minLength: 8, maxLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  readonly referralCode!: string;

  @ApiProperty({ type: () => DeviceDto })
  @ValidateNested()
  @Type(() => DeviceDto)
  @IsNotEmpty()
  readonly deviceInfo!: DeviceDto;
}
