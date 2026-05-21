import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsNotEmpty()
  @IsString()
  readonly clientId!: string;

  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @IsString()
  readonly model?: string;
}
