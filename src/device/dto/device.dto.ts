import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const DEVICE_TEXT_MAX_LENGTH = 120;

export class DeviceDto {
  @ApiProperty({ format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  readonly clientId!: string;

  @ApiPropertyOptional({ maxLength: DEVICE_TEXT_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_TEXT_MAX_LENGTH)
  readonly name?: string;

  @ApiPropertyOptional({ maxLength: DEVICE_TEXT_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(DEVICE_TEXT_MAX_LENGTH)
  readonly model?: string;
}
