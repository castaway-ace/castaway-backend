import { ApiProperty } from '@nestjs/swagger';
import { Playlist, PlaylistSummary, PlaylistTrack } from './playlists.types.js';
import { PlaylistType } from '../generated/prisma/enums.js';
import { AlbumRef, ArtistRef } from '../common/entities/references.entity.js';

export class PlaylistEntity implements Playlist {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({
    enum: [PlaylistType],
    enumName: 'PlaylistType',
  })
  type!: PlaylistType;

  @ApiProperty({ type: [String] })
  albumCoverUrls!: string[];
}

export class PlaylistSummaryEntity implements PlaylistSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    enum: [PlaylistType],
    enumName: 'PlaylistType',
  })
  type!: PlaylistType;

  @ApiProperty({ type: [String] })
  albumCoverUrls!: string[];
}

export class PlaylistTrackEntity implements PlaylistTrack {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  trackId!: string;

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  trackNumber!: number;

  @ApiProperty()
  discNumber!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];
}
