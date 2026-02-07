import { Prisma } from '../generated/prisma/client.js';
import * as mm from 'music-metadata';

export type TrackItemWithRelations = Prisma.TrackGetPayload<{
  select: {
    id: true;
    title: true;
    duration: true;
    artists: {
      select: {
        artist: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    album: {
      select: {
        id: true;
        title: true;
        albumArtKey: true;
      };
    };
  };
}>;

export type TrackWithRelations = Prisma.TrackGetPayload<{
  include: {
    artists: { include: { artist: true } };
    album: { include: { artist: true } };
    audioFile: { select: { storageKey: true } };
  };
}>;

export type AlbumWithRelations = Prisma.AlbumGetPayload<{
  select: {
    id: true;
    albumArtKey: true;
  };
}>;

/**
 * Result of uploading a single track
 */
export interface UploadResult {
  trackId: string;
  duplicate: boolean;
  message: string;
}

/**
 * Result of uploading multiple tracks as an album
 */
export interface AlbumUploadResult {
  trackIds: string[];
  duplicates: string[];
  failures: Array<{ filename: string; error: string }>;
  message: string;
}

/**
 * Query parameters for filtering tracks
 */
export interface TrackFilter {
  limit?: number;
  offset?: number;
  artist?: string;
  album?: string;
}

/**
 * Metadata extracted from audio file using music-metadata library
 */
export interface ExtractedMetadata {
  title: string;
  album: string;
  artists: string[];
  albumArtist: string;
  trackNumber: number | null;
  discNumber: number | null;
  releaseYear: number | null;
  genre: string | null;
  duration: number;
  format: string;
  bitrate: number | null;
  sampleRate: number | null;
  picture?: mm.IPicture;
}

export interface StreamItemResponse {
  url: string;
  expiresIn: number;
}

export type AudioFileWithTrackVisibility = Prisma.AudioFileGetPayload<{
  include: {
    track: {
      select: {
        id: true;
        isPublic: true;
      };
    };
  };
}>;

export type ArtistWithAlbums = Prisma.ArtistGetPayload<{
  include: {
    albums: {
      include: {
        tracks: {
          include: {
            audioFile: true;
          };
        };
      };
    };
  };
}>;

export type AlbumWithTracks = Prisma.AlbumGetPayload<{
  include: {
    artist: true;
    tracks: {
      include: {
        artists: {
          include: {
            artist: true;
          };
        };
        audioFile: true;
      };
    };
  };
}>;
