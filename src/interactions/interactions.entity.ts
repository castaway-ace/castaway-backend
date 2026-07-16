import { ApiProperty } from '@nestjs/swagger';
import {
  AlbumRef,
  ArtistRef,
  PlaylistRef,
} from '../common/entities/references.entity.js';
import { PlaylistType } from '../generated/prisma/enums.js';
import {
  AlbumInteraction,
  ArtistInteraction,
  InteractionType,
  PlaylistInteraction,
} from './interactions.types.js';

export class ArtistInteractionEntity implements ArtistInteraction {
  @ApiProperty({
    enum: [InteractionType.ARTIST],
    enumName: 'InteractionTypeArtist',
  })
  type!: InteractionType.ARTIST;

  @ApiProperty()
  id!: string;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: () => ArtistRef })
  artist!: ArtistRef;

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;
}

export class PlaylistInteractionEntity implements PlaylistInteraction {
  @ApiProperty({
    enum: [InteractionType.PLAYLIST],
    enumName: 'InteractionTypePlaylist',
  })
  type!: InteractionType.PLAYLIST;

  @ApiProperty()
  id!: string;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: () => PlaylistRef })
  playlist!: PlaylistRef;

  @ApiProperty({ type: [String] })
  coverUrls!: string[];

  @ApiProperty({
    enum: [PlaylistType],
    enumName: 'PlaylistType',
  })
  playlistType!: PlaylistType;
}

export class AlbumInteractionEntity implements AlbumInteraction {
  @ApiProperty({
    enum: [InteractionType.ALBUM],
    enumName: 'InteractionTypeAlbum',
  })
  type!: InteractionType.ALBUM;

  @ApiProperty()
  id!: string;

  @ApiProperty({ type: Date })
  updatedAt!: Date;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;
}
