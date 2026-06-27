import { ApiProperty } from '@nestjs/swagger';

export class ArtistRef {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class AlbumRef {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class TrackRef {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class PlaylistRef {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
