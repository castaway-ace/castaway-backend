import { Prisma } from '../generated/prisma/client.js';
import { PlaylistType } from '../generated/prisma/enums.js';
import { ArtistRefData } from '../common/artist-ref.js';

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
  playlist: { select: { name: true, id: true, type: true } },
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

export type ArtistInteraction = Omit<ArtistInteractionRow, 'artist'> & {
  type: InteractionType.ARTIST;
  coverUrl: string | null;
  artist: ArtistRefData;
};

export type PlaylistInteraction = Omit<PlaylistInteractionRow, 'playlist'> & {
  type: InteractionType.PLAYLIST;
  coverUrls: string[];
  playlist: { id: string; name: string };
  /**
   * Lifted out of the selected `playlist` row so it stays a plain `PlaylistRef`
   * over the wire; named apart from `type`, the union's discriminant.
   */
  playlistType: PlaylistType;
};

export type AlbumInteraction = Omit<AlbumInteractionRow, 'album'> & {
  type: InteractionType.ALBUM;
  coverUrl: string | null;
  artists: ArtistRefData[];
  album: {
    title: string;
    id: string;
  };
};

export type Interaction =
  AlbumInteraction | ArtistInteraction | PlaylistInteraction;
