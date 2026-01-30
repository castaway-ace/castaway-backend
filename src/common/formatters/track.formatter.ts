export function formatTrackResponse(track: {
  id: string;
  title: string;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  artists: Array<{
    order: number;
    artist: {
      id: string;
      name: string;
    };
  }>;
  album: {
    id: string;
    title: string;
    releaseYear: number | null;
    genre: string | null;
    albumArtKey: string | null;
    artist: {
      id: string;
      name: string;
    };
  };
  audioFile?: {
    storageKey: string;
    format: string;
    bitrate: number | null;
    sampleRate: number | null;
    fileSize: bigint;
  } | null;
}) {
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
          format: track.audioFile.format,
          bitrate: track.audioFile.bitrate,
          sampleRate: track.audioFile.sampleRate,
          fileSize: track.audioFile.fileSize.toString(),
        }
      : null,
  };
}
