import { Prisma } from '../generated/prisma/client.js';
import * as mm from 'music-metadata';

// ==================== PRISMA-GENERATED TYPES ====================

/**
 * Playlist with tracks and user
 * Generated from Prisma schema
 */
export type PlaylistWithTracks = Prisma.PlaylistGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    tracks: {
      include: {
        track: {
          include: {
            artists: { include: { artist: true } };
            album: { include: { artist: true } };
            audioFile: true;
          };
        };
      };
    };
  };
}>;

// ==================== SERVICE LAYER TYPES ====================

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
  artist?: string;
  album?: string;
  limit?: number;
  offset?: number;
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

// ==================== API RESPONSE TYPES ====================

/**
 * Formatted track for API responses
 */
export interface FormattedTrack {
  id: string;
  title: string;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    title: string;
    releaseYear: number | null;
    genre: string | null;
    albumArtKey: string | null;
    artist: {
      id: string;
      name: string;
    };
  };
  audioFile: {
    storageKey: string;
    format: string;
    bitrate: number | null;
    sampleRate: number | null;
    fileSize: string;
  } | null;
}

/**
 * Formatted playlist for API responses
 */
export interface FormattedPlaylist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverImage: string | null;
  trackCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Formatted artist for API responses
 */
export interface FormattedArtist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
}

/**
 * Formatted album for API responses
 */
export interface FormattedAlbum {
  id: string;
  title: string;
  releaseYear: number | null;
  genre: string | null;
  albumArtKey: string | null;
  trackCount: number;
  totalDuration: number;
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
