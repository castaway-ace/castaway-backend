export const VARIOUS_ARTISTS_NAME = 'Various Artists';

/**
 * Name of the BullMQ queue that carries async album-import jobs. The producer
 * (upload-session finalize) and the worker's processor both refer to this so
 * the queue name never drifts between them.
 */
export const ALBUM_INGEST_QUEUE = 'album-ingest';

/** Job name for a single album-import job on the album-ingest queue. */
export const ALBUM_INGEST_JOB = 'ingest-album';

export const mimeToSuffix: Record<string, string> = {
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
};
