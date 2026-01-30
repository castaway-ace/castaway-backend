import { Prisma } from '../generated/prisma/client.js';

/**
 * Album with artist relation
 * Generated from Prisma schema
 */
export type AlbumWithArtist = Prisma.AlbumGetPayload<{
  include: { artist: true };
}>;

/**
 * Artist (base model)
 * Generated from Prisma schema
 */
export type Artist = Prisma.ArtistGetPayload<Record<string, never>>;
