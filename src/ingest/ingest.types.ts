import { IPicture } from 'music-metadata';
import { MetadataTags } from '../admin/admin.types.js';

/**
 * A parsed track ready to be planned, decoupled from any transport: the sync
 * admin path builds these from multer temp files, and the async worker builds
 * them from staged storage objects. Deliberately carries no `Express.Multer.File`.
 */
export interface ParsedTrackInput {
  tags: MetadataTags;
  suffix: string;
  size: number;
}

/** A single track resolved to its final object key and artist ids. */
export interface TrackImportPlan {
  tags: MetadataTags;
  suffix: string;
  size: number;
  fileKey: string;
  trackArtistIds: string[];
}

/**
 * The fully validated, source-agnostic plan for importing one album: object
 * keys to write and the rows to persist. Produced by `IngestService.planAlbum`
 * and consumed by both the storage-upload step and `persistImport`.
 */
export interface AlbumImportPlan {
  albumId: string;
  identityKey: string;
  albumTitle: string;
  releaseDate: Date;
  albumArtistIds: string[];
  coverKey: string | null;
  cover: IPicture | undefined;
  tracks: TrackImportPlan[];
}
