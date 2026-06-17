import { Prisma } from 'generated/prisma/client.js';

export const playlistSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  type: true,
} satisfies Prisma.PlaylistSelect;

export const playlistSummarySelect = {
  id: true,
  name: true,
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
    },
  },
} satisfies Prisma.PlaylistTrackSelect;

export type Playlist = Prisma.PlaylistGetPayload<{
  select: typeof playlistSelect;
}>;

export type PlaylistSummary = Prisma.PlaylistGetPayload<{
  select: typeof playlistSummarySelect;
}>;

export type PlaylistTrackRow = Prisma.PlaylistTrackGetPayload<{
  select: typeof playlistTrackSelect;
}>;

type PlaylistTrackArtistRow =
  PlaylistTrackRow['track']['trackArtists'][number]['artist'];

export type PlaylistTrack = Omit<PlaylistTrackRow, 'track'> & {
  trackId: string;
  title: string;
  artists: PlaylistTrackArtistRow[];
};
