import { VARIOUS_ARTISTS_NAME } from './constants.js';

/**
 * An artist credit as returned to clients: the id/name plus `isVarious`, which
 * flags the synthetic "Various Artists" entity used on compilation albums.
 * Clients treat that entity as display-only (never navigable or interactive).
 */
export type ArtistRefData = {
  id: string;
  name: string;
  isVarious: boolean;
};

/** Whether a name is the canonical "Various Artists" credit ({@link VARIOUS_ARTISTS_NAME}). */
export const isVariousArtistName = (name: string): boolean =>
  name === VARIOUS_ARTISTS_NAME;

/**
 * Maps a selected `{ id, name }` artist into an {@link ArtistRefData}, deriving
 * `isVarious` from the name. Identity is by name because that column is unique
 * and the "Various Artists" row is seeded/upserted under {@link VARIOUS_ARTISTS_NAME}.
 */
export const toArtistRef = (artist: {
  id: string;
  name: string;
}): ArtistRefData => ({
  id: artist.id,
  name: artist.name,
  isVarious: isVariousArtistName(artist.name),
});
