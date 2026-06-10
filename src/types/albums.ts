import {
  Album as PrismaAlbum,
  Track as PrismaTrack,
} from 'generated/prisma/client.js';

type AlbumTrack = Omit<
  PrismaTrack,
  | 'fileKey'
  | 'size'
  | 'suffix'
  | 'bitRate'
  | 'sampleRate'
  | 'bitDepth'
  | 'createdAt'
  | 'discNumber'
  | 'updatedAt'
  | 'releaseDate'
  | 'genres'
> & { artistNames: string[] };

export type Album = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'imageKey'
> & {
  artists: string[];
  tracks: AlbumTrack[];
};

export type AlbumSummary = Omit<
  PrismaAlbum,
  'createdAt' | 'updatedAt' | 'compilation' | 'imageKey'
> & {
  artists: string[];
};
