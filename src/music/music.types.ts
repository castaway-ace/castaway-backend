import { Prisma } from '../generated/prisma/client.js';
import * as mm from 'music-metadata';

// ==================== TRACK TYPES ====================

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
    audioFile: { select: { storageKey: true; mimeType: true; size: true } };
  };
}>;

// ==================== ALBUM TYPES ====================

export type AlbumArtInfo = Prisma.AlbumGetPayload<{
  select: {
    id: true;
    albumArtKey: true;
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

export type AlbumListItem = Prisma.AlbumGetPayload<{
  select: {
    id: true;
    title: true;
    releaseYear: true;
    genre: true;
    albumArtKey: true;
    artist: {
      select: {
        id: true;
        name: true;
      };
    };
    _count: {
      select: {
        tracks: true;
      };
    };
  };
}>;

// ==================== ARTIST TYPES ====================

export type ArtistWithCounts = Prisma.ArtistGetPayload<{
  select: {
    id: true;
    name: true;
    _count: {
      select: {
        albums: true;
        tracks: true;
      };
    };
  };
}>;

export type ArtistWithAlbums = Prisma.ArtistGetPayload<{
  include: {
    albums: {
      include: {
        tracks: {
          select: {
            duration: true;
          };
        };
      };
    };
  };
}>;

export type AudioFileWithTrackVisibility = Prisma.AudioFileGetPayload<{
  include: {
    track: true;
  };
}>;

// ==================== SEARCH TYPES ====================

export type SearchTrack = Prisma.TrackGetPayload<{
  include: {
    artists: { include: { artist: true } };
    album: { include: { artist: true } };
    audioFile: { select: { storageKey: true; mimeType: true; size: true } };
  };
}>;

export type SearchArtist = Prisma.ArtistGetPayload<{
  include: {
    _count: {
      select: {
        albums: true;
        tracks: true;
      };
    };
  };
}>;

export type SearchAlbum = Prisma.AlbumGetPayload<{
  include: {
    artist: true;
    _count: {
      select: {
        tracks: true;
      };
    };
  };
}>;

export interface SearchResults {
  tracks?: SearchTrack[];
  artists?: SearchArtist[];
  albums?: SearchAlbum[];
}

// ==================== UPLOAD TYPES ====================

export interface UploadResult {
  trackId: string;
  duplicate: boolean;
  message: string;
}

export interface AlbumUploadResult {
  trackIds: string[];
  duplicates: string[];
  failures: Array<{ filename: string; error: string }>;
  message: string;
}

// ==================== FILTER TYPES ====================

export interface TrackFilter {
  limit?: number;
  offset?: number;
  artist?: string;
  album?: string;
}

// ==================== METADATA TYPES ====================

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
  mimeType: string;
  bitrate: number | null;
  sampleRate: number | null;
  picture?: mm.IPicture;
}

// ==================== STREAMING TYPES ====================

export interface StreamDescriptor {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  size: number;
  range?: {
    start: number;
    end: number;
    length: number;
  };
}

// ==================== STATS TYPES ====================

export interface TrackStats {
  trackId: string;
  totalPlays: number;
}
