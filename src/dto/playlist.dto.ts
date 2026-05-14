import { IsNotEmpty, IsString } from 'class-validator';

export class PlaylistDto {
  @IsString()
  @IsNotEmpty()
  readonly name!: string;
}
