import { Artist } from 'generated/prisma/client.js';

export type Artist_ = Omit<Artist, 'createdAt' | 'updatedAt' | 'bio'>;

export type Artists = Artist_[];
