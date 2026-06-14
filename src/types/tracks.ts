import { Prisma } from 'generated/prisma/client.js';

export const trackSelect = {
  id: true,
  title: true,
  genres: true,
  duration: true,
  releaseDate: true,
  suffix: true,
  bitRate: true,
  albumId: true,
  sampleRate: true,
  bitDepth: true,
  trackNumber: true,
  discNumber: true,
  size: true,
  trackArtists: {
    select: {
      artist: {
        select: { name: true, id: true },
      },
    },
  },
  album: {
    select: { title: true, id: true },
  },
} satisfies Prisma.TrackSelect;

export const trackSummarySelect = {
  id: true,
  title: true,
  genres: true,
  duration: true,
  releaseDate: true,
  albumId: true,
  trackNumber: true,
  album: {
    select: { title: true, id: true },
  },
  trackArtists: {
    select: {
      artist: {
        select: { name: true, id: true },
      },
    },
  },
} satisfies Prisma.TrackSelect;

type TrackRow = Prisma.TrackGetPayload<{ select: typeof trackSelect }>;
type TrackSummaryRow = Prisma.TrackGetPayload<{
  select: typeof trackSummarySelect;
}>;

type TrackArtistRow = TrackRow['trackArtists'][number]['artist'];

export type Track = Omit<TrackRow, 'trackArtists'> & {
  artists: TrackArtistRow[];
};

export type TrackSummary = Omit<TrackSummaryRow, 'trackArtists'> & {
  artists: TrackArtistRow[];
  starred: boolean;
};

// export type Track = Omit<
//   PrismaTrack,
//   'trackArtists' | 'createdAt' | 'updatedAt' | 'fileKey'
// > & { albumName: string; artistNames: string[] };

// export type TrackSummary = Omit<
//   PrismaTrack,
//   | 'fileKey'
//   | 'size'
//   | 'suffix'
//   | 'bitRate'
//   | 'sampleRate'
//   | 'bitDepth'
//   | 'createdAt'
//   | 'discNumber'
//   | 'updatedAt'
// > & { albumName: string; artistNames: string[] };
