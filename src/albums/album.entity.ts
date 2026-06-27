import { ApiProperty } from '@nestjs/swagger';
import { Album, AlbumSummary, AlbumTrack } from '../types/albums.js';

export class ArtistRefEntity {
  id!: string;
  name!: string;
}

export class AlbumRefEntity {
  id!: string;
  title!: string;
}

export class AlbumTrackEntity implements AlbumTrack {
  id!: string;
  title!: string;
  genres!: string[];
  duration!: number;
  trackNumber!: number;
  discNumber!: number;
  @ApiProperty({ type: () => AlbumRefEntity })
  album!: AlbumRefEntity;
  @ApiProperty({ type: () => ArtistRefEntity, isArray: true })
  artists!: ArtistRefEntity[];
}

export class AlbumEntity implements Album {
  id!: string;
  title!: string;
  releaseDate!: Date;
  compilation!: boolean;
  genres!: string[];
  starred!: boolean;
  @ApiProperty({ type: () => ArtistRefEntity, isArray: true })
  artists!: ArtistRefEntity[];
  @ApiProperty({ type: () => AlbumTrackEntity, isArray: true })
  tracks!: AlbumTrackEntity[];
}

export class AlbumSummaryEntity implements AlbumSummary {
  id!: string;
  title!: string;
  releaseDate!: Date;
  genres!: string[];
  @ApiProperty({ type: () => ArtistRefEntity, isArray: true })
  artists!: ArtistRefEntity[];
}
