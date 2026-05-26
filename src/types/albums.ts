import { Album } from 'generated/prisma/client.js';

export type Album_ = Omit<Album, 'createdAt' | 'updatedAt' | 'compilation'> & {
  artists: string[];
};

export type Albums = Album_[];
