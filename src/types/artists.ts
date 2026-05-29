import { Artist as PrismaArtist } from 'generated/prisma/client.js';

export type Artist = Omit<PrismaArtist, 'createdAt' | 'updatedAt' | 'imageKey'>;

export type ArtistSummary = Omit<
  PrismaArtist,
  'createdAt' | 'updatedAt' | 'imageKey' | 'bio'
>;
