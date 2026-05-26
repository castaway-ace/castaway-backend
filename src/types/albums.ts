import { Album } from 'generated/prisma/client.js';
import { Readable } from 'stream';

export type Album_ = Omit<
  Album,
  'createdAt' | 'updatedAt' | 'compilation' | 'imageKey'
> & {
  artists: string[];
  imageUrl: Readable;
};

export type Albums = Album_[];
