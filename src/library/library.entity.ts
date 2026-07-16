import { ApiProperty } from '@nestjs/swagger';
import {
  AlbumRef,
  ArtistRef,
  PlaylistRef,
} from '../common/entities/references.entity.js';
import { PlaylistType } from '../generated/prisma/enums.js';
import {
  AlbumLibraryItem,
  ArtistLibraryItem,
  LibraryItemType,
  PlaylistLibraryItem,
} from './library.types.js';

export class ArtistLibraryItemEntity implements ArtistLibraryItem {
  @ApiProperty({
    enum: [LibraryItemType.ARTIST],
    enumName: 'LibraryItemTypeArtist',
  })
  type!: LibraryItemType.ARTIST;

  @ApiProperty({ type: () => ArtistRef })
  artist!: ArtistRef;

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  lastInteractedAt!: Date | null;
}

export class PlaylistLibraryItemEntity implements PlaylistLibraryItem {
  @ApiProperty({
    enum: [LibraryItemType.PLAYLIST],
    enumName: 'LibraryItemTypePlaylist',
  })
  type!: LibraryItemType.PLAYLIST;

  @ApiProperty({ type: () => PlaylistRef })
  playlist!: PlaylistRef;

  @ApiProperty({ type: [String] })
  coverUrls!: string[];

  @ApiProperty({
    enum: [PlaylistType],
    enumName: 'PlaylistType',
  })
  playlistType!: PlaylistType;

  @ApiProperty({ type: Date, nullable: true })
  lastInteractedAt!: Date | null;
}

export class AlbumLibraryItemEntity implements AlbumLibraryItem {
  @ApiProperty({
    enum: [LibraryItemType.ALBUM],
    enumName: 'LibraryItemTypeAlbum',
  })
  type!: LibraryItemType.ALBUM;

  @ApiProperty({ type: () => AlbumRef })
  album!: AlbumRef;

  @ApiProperty({ type: () => ArtistRef, isArray: true })
  artists!: ArtistRef[];

  @ApiProperty({ type: String, nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  lastInteractedAt!: Date | null;
}
