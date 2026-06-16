import { Prisma } from 'generated/prisma/client.js';

export const playlistSelect = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  tracks: true,
} satisfies Prisma.PlaylistSelect;

export const playlistSummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.PlaylistSelect;

export type Playlist = Prisma.PlaylistGetPayload<{
  select: typeof playlistSelect;
}>;

export type PlaylistSummary = Prisma.PlaylistGetPayload<{
  select: typeof playlistSummarySelect;
}>;
