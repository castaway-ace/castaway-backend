import {
  Artist as PrismaArtist,
  Album as PrismaAlbum,
} from 'generated/prisma/client.js';

export type Artist = Omit<PrismaArtist, 'createdAt' | 'updatedAt' | 'imageKey'>;

export type ArtistSummary = Omit<
  PrismaArtist,
  'createdAt' | 'updatedAt' | 'imageKey' | 'bio'
>;

export type ArtistAlbum = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'compilation' | 'genres'
>;
