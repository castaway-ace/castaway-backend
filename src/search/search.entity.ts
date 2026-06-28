import { ApiProperty } from '@nestjs/swagger';
import { AlbumSummaryEntity } from '../albums/albums.entity.js';
import { ArtistSummaryEntity } from '../artists/artists.entity.js';
import { TrackSummaryEntity } from '../tracks/tracks.entity.js';

export class SearchResultsEntity {
  @ApiProperty({ type: () => AlbumSummaryEntity, isArray: true })
  albums!: AlbumSummaryEntity[];

  @ApiProperty({ type: () => ArtistSummaryEntity, isArray: true })
  artists!: ArtistSummaryEntity[];

  @ApiProperty({ type: () => TrackSummaryEntity, isArray: true })
  tracks!: TrackSummaryEntity[];
}
