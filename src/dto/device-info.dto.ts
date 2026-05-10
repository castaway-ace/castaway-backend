import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class DeviceInfoDto {
  @IsOptional()
  @IsString()
  readonly name!: string;

  @IsOptional()
  @IsString()
  readonly model!: string;

  @IsUUID()
  @IsNotEmpty()
  readonly id!: string;
}
