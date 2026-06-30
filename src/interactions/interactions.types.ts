import { Prisma } from '../generated/prisma/client.js';

export enum InteractionType {
  ALBUM = 'album',
  ARTIST = 'artist',
  PLAYLIST = 'playlist',
}

export const artistInteractionSelect = {
  id: true,
  updatedAt: true,
  artist: { select: { name: true, id: true } },
} satisfies Prisma.ArtistInteractionSelect;

export const playlistInteractionSelect = {
  id: true,
  updatedAt: true,
  playlist: { select: { name: true, id: true } },
} satisfies Prisma.PlaylistInteractionSelect;

export const albumInteractionSelect = {
  id: true,
  updatedAt: true,
  album: {
    select: {
      id: true,
      title: true,
      albumArtists: {
        select: { artist: { select: { name: true, id: true } } },
      },
    },
  },
} satisfies Prisma.AlbumInteractionSelect;

type ArtistInteractionRow = Prisma.ArtistInteractionGetPayload<{
  select: typeof artistInteractionSelect;
}>;
type PlaylistInteractionRow = Prisma.PlaylistInteractionGetPayload<{
  select: typeof playlistInteractionSelect;
}>;
type AlbumInteractionRow = Prisma.AlbumInteractionGetPayload<{
  select: typeof albumInteractionSelect;
}>;

type AlbumArtistRow =
  AlbumInteractionRow['album']['albumArtists'][number]['artist'];

export type ArtistInteraction = ArtistInteractionRow & {
  type: InteractionType.ARTIST;
  coverUrl: string | null;
};

export type PlaylistInteraction = PlaylistInteractionRow & {
  type: InteractionType.PLAYLIST;
  coverUrls: string[];
};

export type AlbumInteraction = Omit<AlbumInteractionRow, 'album'> & {
  type: InteractionType.ALBUM;
  coverUrl: string | null;
  artists: AlbumArtistRow[];
  album: {
    title: string;
    id: string;
  };
};

export type Interaction =
  AlbumInteraction | ArtistInteraction | PlaylistInteraction;
