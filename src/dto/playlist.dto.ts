import { IsNotEmpty, IsString } from 'class-validator';

export class PlaylistCreateDto {
  @IsString()
  @IsNotEmpty()
  readonly name!: string;
}
