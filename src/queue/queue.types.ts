import { Prisma } from '../generated/prisma/client.js';

/**
 * Track with all relations (artists, album, audioFile)
 * Generated from Prisma schema
 */
export type TrackWithRelations = Prisma.TrackGetPayload<{
  include: {
    artists: { include: { artist: true } };
    album: { include: { artist: true } };
    audioFile: true;
  };
}>;
