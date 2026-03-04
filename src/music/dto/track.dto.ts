import { TrackItemWithRelations, TrackWithRelations } from '../music.types.js';

// ==================== TRACK ITEM (list view) ====================

export class TrackItemDto {
  id: string;
  title: string;
  duration: number | null;
  artists: Array<{ id: string; name: string }>;
  album: { id: string; title: string; albumArtKey: string | null };

  static from(track: TrackItemWithRelations): TrackItemDto {
    return {
      id: track.id,
      title: track.title,
      duration: track.duration,
      artists: track.artists.map((ta) => ({
        id: ta.artist.id,
        name: ta.artist.name,
      })),
      album: {
        id: track.album.id,
        title: track.album.title,
        albumArtKey: track.album.albumArtKey,
      },
    };
  }
}

export interface TrackListResponseDto {
  data: TrackItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ==================== TRACK DETAIL (single view) ====================

export class TrackDetailDto {
  id: string;
  title: string;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    title: string;
    releaseYear: number | null;
    genre: string | null;
    albumArtKey: string | null;
    artist: { id: string; name: string };
  };
  audioFile: {
    storageKey: string;
    mimeType: string;
    size: string;
  } | null;

  static from(track: TrackWithRelations): TrackDetailDto {
    const sortedArtists = [...track.artists].sort((a, b) => a.order - b.order);

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
      album: {
        id: track.album.id,
        title: track.album.title,
        releaseYear: track.album.releaseYear,
        genre: track.album.genre,
        albumArtKey: track.album.albumArtKey,
        artist: {
          id: track.album.artist.id,
          name: track.album.artist.name,
        },
      },
      audioFile: track.audioFile
        ? {
            storageKey: track.audioFile.storageKey,
            mimeType: track.audioFile.mimeType,
            size: track.audioFile.size.toString(),
          }
        : null,
    };
  }
}
