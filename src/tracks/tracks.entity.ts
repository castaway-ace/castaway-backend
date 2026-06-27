import { ApiProperty } from '@nestjs/swagger';
import { AlbumRef, ArtistRef } from '../common/entities/references.entity.js';
import { Track, TrackSummary } from './tracks.types.js';

export class TrackEntity implements Track {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  releaseDate!: Date;

  @ApiProperty()
  trackNumber!: number;

  @ApiProperty()
  discNumber!: number;

  @ApiProperty()
  size!: number;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];
}

export class TrackSummaryEntity implements TrackSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  releaseDate!: Date;

  @ApiProperty()
  trackNumber!: number;

  @ApiProperty()
  starred!: boolean;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];
}
