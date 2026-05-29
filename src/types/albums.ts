import { Album as PrismaAlbum } from 'generated/prisma/client.js';

export type Album = Omit<PrismaAlbum, 'createdAt' | 'updatedAt'> & {
  artists: string[];
};

export type AlbumSummary = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'compilation' | 'imageKey'
> & {
  artists: string[];
};
