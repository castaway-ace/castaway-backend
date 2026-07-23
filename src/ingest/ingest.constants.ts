/**
 * Name of the BullMQ queue that carries async album-import jobs. Producers
 * (the upload-session finalize endpoint) and the worker's processor both refer
 * to this constant so the queue name never drifts between them.
 */
export const ALBUM_INGEST_QUEUE = 'album-ingest';
