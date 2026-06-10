import { Album as PrismaAlbum, Track } from 'generated/prisma/client.js';

export type Album = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'imageKey'
> & {
  artists: string[];
  tracks: Track[];
};

export type AlbumSummary = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'compilation' | 'imageKey'
> & {
  artists: string[];
};
