import { IsNotEmpty, IsString } from 'class-validator';

export class PlaylistTrackDto {
  @IsString()
  @IsNotEmpty()
  readonly id!: string;
}
