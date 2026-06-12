import { Album as PrismaAlbum } from 'generated/prisma/client.js';
import { TrackSummary } from './tracks.js';

export type Album = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'imageKey'
> & {
  artists: string[];
  tracks: TrackSummary[];
};

export type AlbumSummary = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'compilation' | 'imageKey'
> & {
  artists: string[];
};
