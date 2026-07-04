import { Prisma } from '../generated/prisma/client.js';

export const artistSelect = {
  name: true,
  id: true,
  bio: true,
  albumArtists: {
    select: {
      album: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} satisfies Prisma.ArtistSelect;

export const artistSummarySelect = {
  name: true,
  id: true,
} satisfies Prisma.ArtistSelect;

export type ArtistRow = Prisma.ArtistGetPayload<{
  select: typeof artistSelect;
}>;
type AlbumRow = ArtistRow['albumArtists'][number]['album'];

export type ArtistSummaryRow = Prisma.ArtistGetPayload<{
  select: typeof artistSummarySelect;
}>;

export type Artist = Omit<ArtistRow, 'albumArtists'> & {
  albums: AlbumRow[];
};

export type ArtistSummary = ArtistSummaryRow & {
  starred: boolean;
};

export type ArtistCreateData = Pick<
  Prisma.ArtistUncheckedCreateInput,
  'name'
> & { id: string; imageKey?: string };
