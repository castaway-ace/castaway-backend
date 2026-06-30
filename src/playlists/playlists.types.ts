import { Prisma } from '../generated/prisma/client.js';

export const playlistIdentitySelect = {
  id: true,
  ownerId: true,
  type: true,
} satisfies Prisma.PlaylistSelect;

export const playlistSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  type: true,
  tracks: {
    select: {
      track: {
        select: {
          albumId: true,
        },
      },
    },
  },
} satisfies Prisma.PlaylistSelect;

export const playlistSummarySelect = {
  id: true,
  name: true,
  type: true,
  tracks: {
    select: {
      track: {
        select: {
          albumId: true,
        },
      },
    },
  },
} satisfies Prisma.PlaylistSelect;

export const playlistTrackSelect = {
  id: true,
  position: true,
  track: {
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
} satisfies Prisma.PlaylistTrackSelect;

export type PlaylistRow = Prisma.PlaylistGetPayload<{
  select: typeof playlistSelect;
}>;

export type PlaylistSummaryRow = Prisma.PlaylistGetPayload<{
  select: typeof playlistSummarySelect;
}>;

export type PlaylistTrackRow = Prisma.PlaylistTrackGetPayload<{
  select: typeof playlistTrackSelect;
}>;

export type PlaylistTracksRow = PlaylistRow['tracks'];

type PlaylistTrackArtistRow =
  PlaylistTrackRow['track']['trackArtists'][number]['artist'];

type PlaylistTrackAlbumRow = PlaylistTrackRow['track']['album'];

export type Playlist = Omit<PlaylistRow, 'tracks'> & {
  albumCoverUrls: string[];
};

export type PlaylistSummary = Omit<PlaylistSummaryRow, 'tracks'> & {
  albumCoverUrls: string[];
};

export type PlaylistTrack = Omit<PlaylistTrackRow, 'track' | 'position'> & {
  id: string;
  trackId: string;
  genres: string[];
  duration: number;
  trackNumber: number;
  discNumber: number;
  title: string;
  album: PlaylistTrackAlbumRow;
  artists: PlaylistTrackArtistRow[];
};

export type PlaylistIdentity = Prisma.PlaylistGetPayload<{
  select: typeof playlistIdentitySelect;
}>;
