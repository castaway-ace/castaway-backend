import { Playlist as PrismaPlaylist } from 'generated/prisma/client.js';

export type Playlist = Omit<PrismaPlaylist, 'createdAt' | 'updatedAt'>;

export type PlaylistSummary = Omit<
  PrismaPlaylist,
  'createdAt' | 'updatedAt' | 'ownerId' | 'description'
>;
