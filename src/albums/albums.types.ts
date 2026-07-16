import { Prisma } from '../generated/prisma/client.js';
import { ArtistRefData } from '../common/artist-ref.js';

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

export type AlbumRow = Prisma.AlbumGetPayload<{ select: typeof albumSelect }>;
export type AlbumSummaryRow = Prisma.AlbumGetPayload<{
  select: typeof albumSummarySelect;
}>;
type AlbumTrackRow = AlbumRow['tracks'][number];

export type AlbumTrack = Omit<AlbumTrackRow, 'trackArtists'> & {
  artists: ArtistRefData[];
};

export type Album = Omit<AlbumRow, 'albumArtists' | 'tracks'> & {
  artists: ArtistRefData[];
  tracks: AlbumTrack[];
  starred: boolean;
};

export type AlbumSummary = Omit<AlbumSummaryRow, 'albumArtists'> & {
  artists: ArtistRefData[];
  starred: boolean;
};

export type AlbumCreateData = Pick<
  Prisma.AlbumUncheckedCreateInput,
  'title' | 'releaseDate' | 'identityKey' | 'imageKey'
> & { id: string; artistIds: string[] };
