import { Prisma } from '../generated/prisma/client.js';
import { ArtistRef } from '../common/entities/references.entity.js';

export enum LibraryItemType {
  ALBUM = 'album',
  ARTIST = 'artist',
  PLAYLIST = 'playlist',
}

/**
 * Each select pulls the caller's own interaction row alongside the entity, so a
 * library item's recency comes back with it rather than from a second pass over
 * the interaction tables. `take: 1` because the schema already guarantees at
 * most one row per (user, entity) — the array is just how Prisma models the
 * relation.
 */
export const libraryPlaylistSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    playlistInteractions: {
      where: { userId },
      select: { updatedAt: true },
      take: 1,
    },
  }) satisfies Prisma.PlaylistSelect;

export const libraryAlbumSelect = (userId: string) =>
  ({
    id: true,
    title: true,
    albumArtists: {
      select: { artist: { select: { name: true, id: true } } },
    },
    albumInteractions: {
      where: { userId },
      select: { updatedAt: true },
      take: 1,
    },
  }) satisfies Prisma.AlbumSelect;

export const libraryArtistSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    artistInteractions: {
      where: { userId },
      select: { updatedAt: true },
      take: 1,
    },
  }) satisfies Prisma.ArtistSelect;

export type LibraryPlaylistRow = Prisma.PlaylistGetPayload<{
  select: ReturnType<typeof libraryPlaylistSelect>;
}>;
export type LibraryAlbumRow = Prisma.AlbumGetPayload<{
  select: ReturnType<typeof libraryAlbumSelect>;
}>;
export type LibraryArtistRow = Prisma.ArtistGetPayload<{
  select: ReturnType<typeof libraryArtistSelect>;
}>;

/** Fields every library item carries, whatever entity it wraps. */
interface LibraryItemBase {
  /**
   * When the user last engaged with this entity, or `null` if never. Unlike the
   * interactions feed — which only surfaces entities that have been interacted
   * with — the library lists everything the user owns or favorited, so this is
   * nullable and drives the ordering.
   */
  lastInteractedAt: Date | null;
}

export interface AlbumLibraryItem extends LibraryItemBase {
  type: LibraryItemType.ALBUM;
  album: { id: string; title: string };
  artists: ArtistRef[];
  coverUrl: string | null;
}

export interface ArtistLibraryItem extends LibraryItemBase {
  type: LibraryItemType.ARTIST;
  artist: { id: string; name: string };
  coverUrl: string | null;
}

export interface PlaylistLibraryItem extends LibraryItemBase {
  type: LibraryItemType.PLAYLIST;
  playlist: { id: string; name: string };
  coverUrls: string[];
}

export type LibraryItem =
  AlbumLibraryItem | ArtistLibraryItem | PlaylistLibraryItem;
