import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DeviceInfoDto {
  @IsNotEmpty()
  @IsUUID()
  readonly clientId!: string;

  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @IsString()
  readonly model?: string;
}
