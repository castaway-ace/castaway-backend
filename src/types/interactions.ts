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

export type ArtistInteraction = Prisma.ArtistInteractionGetPayload<{
  select: typeof artistInteractionSelect;
}> & { type: InteractionType.ARTIST };

export type PlaylistInteraction = Prisma.PlaylistInteractionGetPayload<{
  select: typeof playlistInteractionSelect;
}> & { type: InteractionType.PLAYLIST };

export type AlbumInteraction = Prisma.AlbumInteractionGetPayload<{
  select: typeof albumInteractionSelect;
}> & { type: InteractionType.ALBUM };

export type Interaction =
  | AlbumInteraction
  | ArtistInteraction
  | PlaylistInteraction;
