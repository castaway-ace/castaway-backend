import { SearchResults } from '../music.types.js';

export class SearchResponseDto {
  tracks?: SearchTrackDto[];
  artists?: SearchArtistDto[];
  albums?: SearchAlbumDto[];

  static from(results: SearchResults): SearchResponseDto {
    const response: SearchResponseDto = {};

    if (results.tracks) {
      response.tracks = results.tracks.map((track) => {
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
        };
      });
    }

    if (results.artists) {
      response.artists = results.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        albumCount: artist._count.albums,
        trackCount: artist._count.tracks,
      }));
    }

    if (results.albums) {
      response.albums = results.albums.map((album) => ({
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
      }));
    }

    return response;
  }
}

export interface SearchTrackDto {
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
}

export interface SearchArtistDto {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
}

export interface SearchAlbumDto {
  id: string;
  title: string;
  releaseYear: number | null;
  genre: string | null;
  albumArtKey: string | null;
  trackCount: number;
  artist: { id: string; name: string };
}
