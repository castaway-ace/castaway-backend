import { Artist as PrismaArtist } from 'generated/prisma/client.js';

export type Artist = Omit<PrismaArtist, 'createdAt' | 'updatedAt' | 'imageKey'>;

export type Artist_ = Omit<
  PrismaArtist,
  'createdAt' | 'updatedAt' | 'bio' | 'imageKey'
>;

export type Artists = Artist_[];
