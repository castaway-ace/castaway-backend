import { Prisma } from '../generated/prisma/client.js';

export const albumSelect = {
  id: true,
  title: true,
  releaseDate: true,
  compilation: true,
  genres: true,
  albumArtists: {
    select: {
      artist: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  },
  tracks: {
    select: {
      id: true,
      title: true,
      genres: true,
      duration: true,
      trackNumber: true,
      discNumber: true,
      album: {
        select: {
          id: true,
          title: true,
        },
      },
      trackArtists: {
        select: { artist: { select: { name: true, id: true } } },
      },
    },
  },
} satisfies Prisma.AlbumSelect;

export const albumSummarySelect = {
  id: true,
  title: true,
  releaseDate: true,
  genres: true,
  albumArtists: {
    select: {
      artist: {
        select: {
          name: true,
          id: true,
        },
      },
    },
  },
} satisfies Prisma.AlbumSelect;

type AlbumRow = Prisma.AlbumGetPayload<{ select: typeof albumSelect }>;
type AlbumSummaryRow = Prisma.AlbumGetPayload<{
  select: typeof albumSummarySelect;
}>;
type AlbumTrackRow = AlbumRow['tracks'][number];
type AlbumArtistRow = AlbumRow['albumArtists'][number]['artist'];

export type AlbumTrack = Omit<AlbumTrackRow, 'trackArtists'> & {
  artists: AlbumArtistRow[];
};

export type Album = Omit<AlbumRow, 'albumArtists' | 'tracks'> & {
  artists: AlbumArtistRow[];
  tracks: AlbumTrack[];
  starred: boolean;
};

export type AlbumSummary = Omit<AlbumSummaryRow, 'albumArtists'> & {
  artists: AlbumArtistRow[];
  starred: boolean;
};
