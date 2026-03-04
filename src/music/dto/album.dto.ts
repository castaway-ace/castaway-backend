import { AlbumListItem, AlbumWithTracks } from '../music.types.js';

// ==================== ALBUM ITEM (list view) ====================

export class AlbumItemDto {
  id: string;
  title: string;
  releaseYear: number | null;
  genre: string | null;
  albumArtKey: string | null;
  trackCount: number;
  artist: { id: string; name: string };

  static from(album: AlbumListItem): AlbumItemDto {
    return {
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      trackCount: album._count.tracks,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
    };
  }
}

export interface AlbumListResponseDto {
  data: AlbumItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ==================== ALBUM DETAIL (with tracks) ====================

export class AlbumDetailDto {
  id: string;
  title: string;
  releaseYear: number | null;
  genre: string | null;
  albumArtKey: string | null;
  artist: { id: string; name: string };
  tracks: AlbumTrackDto[];

  static from(album: AlbumWithTracks): AlbumDetailDto {
    return {
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
      tracks: album.tracks.map((track) => {
        const sortedArtists = [...track.artists].sort(
          (a, b) => a.order - b.order,
        );

        return {
          id: track.id,
          title: track.title,
          trackNumber: track.trackNumber,
          discNumber: track.discNumber,
          duration: track.duration,
          artists: sortedArtists.map((ta) => ({
            id: ta.artist.id,
            name: ta.artist.name,
          })),
          audioFile: track.audioFile
            ? {
                storageKey: track.audioFile.storageKey,
                mimeType: track.audioFile.mimeType,
                bitrate: track.audioFile.bitrate,
                sampleRate: track.audioFile.sampleRate,
                size: track.audioFile.size.toString(),
              }
            : null,
        };
      }),
    };
  }
}

export interface AlbumTrackDto {
  id: string;
  title: string;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  artists: Array<{ id: string; name: string }>;
  audioFile: {
    storageKey: string;
    mimeType: string;
    bitrate: number | null;
    sampleRate: number | null;
    size: string;
  } | null;
}
