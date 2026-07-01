import { ApiProperty } from '@nestjs/swagger';
import { Album, AlbumSummary, AlbumTrack } from './albums.types.js';
import { AlbumRef, ArtistRef } from '../common/entities/references.entity.js';

export class AlbumTrackEntity implements AlbumTrack {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  trackNumber!: number;

  @ApiProperty()
  discNumber!: number;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];
}

export class AlbumEntity implements Album {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  releaseDate!: Date;

  @ApiProperty()
  compilation!: boolean;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty()
  starred!: boolean;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];

  @ApiProperty({ type: () => AlbumTrackEntity, isArray: true })
  tracks!: AlbumTrackEntity[];
}

export class AlbumSummaryEntity implements AlbumSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  releaseDate!: Date;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];

  @ApiProperty()
  starred!: boolean;
}
