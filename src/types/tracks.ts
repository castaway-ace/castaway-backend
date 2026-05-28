import { Track as PrismaTrack } from 'generated/prisma/client.js';

export type Track = Omit<
  PrismaTrack,
  'trackArtists' | 'createdAt' | 'updatedAt' | 'fileKey'
> & { artists: string[] };

export type Track_ = Omit<
  PrismaTrack,
  | 'fileKey'
  | 'trackNumber'
  | 'size'
  | 'suffix'
  | 'bitRate'
  | 'sampleRate'
  | 'bitDepth'
  | 'createdAt'
  | 'discNumber'
  | 'updatedAt'
> & { album: string; artists: string[] };

export type Tracks = Track_[];
