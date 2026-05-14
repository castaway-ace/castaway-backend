import { IsNotEmpty, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsNotEmpty()
  @IsString()
  readonly name!: string;

  @IsNotEmpty()
  @IsString()
  readonly model!: string;
}
