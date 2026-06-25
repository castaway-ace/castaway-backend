import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DeviceInfoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  readonly clientId!: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  readonly model?: string;
}
