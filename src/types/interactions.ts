import { Prisma } from 'generated/prisma/client.js';

export enum InteractionType {
  ALBUM = 'album',
  ARTIST = 'artist',
  PLAYLIST = 'playlist',
}

export const artistInteractionSelect = {
  id: true,
  userId: true,
  updatedAt: true,
  artist: { select: { name: true, id: true } },
} satisfies Prisma.ArtistInteractionSelect;

export const playlistInteractionSelect = {
  id: true,
  userId: true,
  updatedAt: true,
  playlist: { select: { name: true, id: true } },
} satisfies Prisma.PlaylistInteractionSelect;

export const albumInteractionSelect = {
  id: true,
  userId: true,
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

export type ArtistInteraction = Omit<ArtistInteractionRow, 'artist'> & {
  type: InteractionType.ARTIST;
  name: string;
  coverUrl: string | null;
};

export type PlaylistInteraction = Omit<PlaylistInteractionRow, 'playlist'> & {
  type: InteractionType.PLAYLIST;
  coverUrls: string[];
  name: string;
};

export type AlbumInteraction = Omit<AlbumInteractionRow, 'album'> & {
  type: InteractionType.ALBUM;
  title: string;
  coverUrl: string | null;
  artists: AlbumArtistRow[];
};

export type Interaction =
  | AlbumInteraction
  | ArtistInteraction
  | PlaylistInteraction;
