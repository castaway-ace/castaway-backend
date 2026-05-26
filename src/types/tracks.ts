import { Track } from 'generated/prisma/client.js';

export type Track_ = Omit<
  Track,
  | 'fileKey'
  | 'trackNumber'
  | 'size'
  | 'suffix'
  | 'bitRate'
  | 'sampleRate'
  | 'bitDepth'
  | 'albumId'
  | 'createdAt'
  | 'discNumber'
  | 'updatedAt'
> & { album: string; artists: string[] };

export type Tracks = Track_[];
