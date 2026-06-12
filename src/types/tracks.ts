import { Track as PrismaTrack } from 'generated/prisma/client.js';

export type Track = Omit<
  PrismaTrack,
  'trackArtists' | 'createdAt' | 'updatedAt' | 'fileKey'
> & { albumName: string; artistNames: string[] };

export type TrackSummary = Omit<
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
> & { albumName: string; artistNames: string[]; starred: boolean };
