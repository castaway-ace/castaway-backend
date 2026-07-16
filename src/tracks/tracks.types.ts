import { Prisma } from '../generated/prisma/client.js';
import { ArtistRefData } from '../common/artist-ref.js';
export const trackSelect = {
  id: true,
  title: true,
  genres: true,
  duration: true,
  releaseDate: true,
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

export type TrackRow = Prisma.TrackGetPayload<{ select: typeof trackSelect }>;
export type TrackSummaryRow = Prisma.TrackGetPayload<{
  select: typeof trackSummarySelect;
}>;

export type Track = Omit<TrackRow, 'trackArtists'> & {
  artists: ArtistRefData[];
};

export type TrackSummary = Omit<TrackSummaryRow, 'trackArtists'> & {
  artists: ArtistRefData[];
  starred: boolean;
};

export type TrackCreateData = Pick<
  Prisma.TrackUncheckedCreateInput,
  | 'title'
  | 'albumId'
  | 'fileKey'
  | 'trackNumber'
  | 'discNumber'
  | 'duration'
  | 'size'
  | 'suffix'
  | 'genres'
  | 'bitRate'
  | 'sampleRate'
  | 'bitDepth'
  | 'releaseDate'
> & {
  artistIds: string[];
};
