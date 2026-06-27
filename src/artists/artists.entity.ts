import { ApiProperty } from '@nestjs/swagger';
import { AlbumRef } from '../common/entities/references.entity.js';
import { Artist, ArtistSummary } from './artists.types.js';

export class ArtistEntity implements Artist {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty()
  starred!: boolean;

  @ApiProperty({ type: () => AlbumRef, isArray: true })
  albums!: AlbumRef[];
}

export class ArtistSummaryEntity implements ArtistSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
