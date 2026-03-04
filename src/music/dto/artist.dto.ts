import { ArtistWithCounts, ArtistWithAlbums } from '../music.types.js';

// ==================== ARTIST ITEM (list view) ====================

export class ArtistItemDto {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;

  static from(artist: ArtistWithCounts): ArtistItemDto {
    return {
      id: artist.id,
      name: artist.name,
      albumCount: artist._count.albums,
      trackCount: artist._count.tracks,
    };
  }
}

export interface ArtistListResponseDto {
  data: ArtistItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ==================== ARTIST ALBUMS (detail view) ====================

export class ArtistAlbumsDto {
  id: string;
  name: string;
  albums: ArtistAlbumItemDto[];

  static from(artist: ArtistWithAlbums): ArtistAlbumsDto {
    return {
      id: artist.id,
      name: artist.name,
      albums: artist.albums.map((album) => ({
        id: album.id,
        title: album.title,
        releaseYear: album.releaseYear,
        genre: album.genre,
        albumArtKey: album.albumArtKey,
        trackCount: album.tracks.length,
      })),
    };
  }
}

export interface ArtistAlbumItemDto {
  id: string;
  title: string;
  releaseYear: number | null;
  genre: string | null;
  albumArtKey: string | null;
  trackCount: number;
}
