import { Prisma } from 'generated/prisma/client.js';

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
} satisfies Prisma.PlaylistSelect;

export const playlistTrackSelect = {
  id: true,
  position: true,
  track: {
    select: {
      title: true,
      id: true,
      trackArtists: {
        select: {
          artist: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      },
      album: {
        select: {
          title: true,
          id: true,
        },
      },
    },
  },
} satisfies Prisma.PlaylistTrackSelect;

export type PlaylistRow = Prisma.PlaylistGetPayload<{
  select: typeof playlistSelect;
}>;

export type PlaylistSummary = Prisma.PlaylistGetPayload<{
  select: typeof playlistSummarySelect;
}>;

export type PlaylistTrackRow = Prisma.PlaylistTrackGetPayload<{
  select: typeof playlistTrackSelect;
}>;

export type PlaylistTracksRow = PlaylistRow['tracks'];

export type Playlist = Omit<PlaylistRow, 'tracks'> & {
  albumCoverUrls: string[];
};

type PlaylistTrackArtistRow =
  PlaylistTrackRow['track']['trackArtists'][number]['artist'];

type PlaylistTrackAlbumRow = PlaylistTrackRow['track']['album'];

export type PlaylistTrack = Omit<PlaylistTrackRow, 'track'> & {
  trackId: string;
  title: string;
  album: PlaylistTrackAlbumRow;
  artists: PlaylistTrackArtistRow[];
};
