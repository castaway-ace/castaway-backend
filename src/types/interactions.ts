import { Prisma } from 'generated/prisma/client.js';

export enum InteractionType {
  ALBUM = 'album',
  ARTIST = 'artist',
  PLAYLIST = 'playlist',
}

export const artistInteractionSelect = {
  id: true,
  artistId: true,
  userId: true,
  updatedAt: true,
  artist: { select: { name: true } },
} satisfies Prisma.ArtistInteractionSelect;

export const playlistInteractionSelect = {
  id: true,
  userId: true,
  playlistId: true,
  updatedAt: true,
  playlist: { select: { name: true } },
} satisfies Prisma.PlaylistInteractionSelect;

export const albumInteractionSelect = {
  id: true,
  userId: true,
  albumId: true,
  updatedAt: true,
  album: {
    select: {
      title: true,
      albumArtists: {
        select: { artist: { select: { name: true } } },
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
};

export type PlaylistInteraction = Omit<PlaylistInteractionRow, 'playlist'> & {
  type: InteractionType.PLAYLIST;
  name: string;
};

export type AlbumInteraction = Omit<AlbumInteractionRow, 'album'> & {
  type: InteractionType.ALBUM;
  title: string;
  artists: AlbumArtistRow[];
};

export type Interaction =
  | AlbumInteraction
  | ArtistInteraction
  | PlaylistInteraction;
