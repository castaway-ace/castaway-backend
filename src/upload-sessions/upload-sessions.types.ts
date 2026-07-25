/** How a single file is uploaded to staging. */
export type UploadMode = 'single' | 'multipart';

/** Validated descriptor of one file the client intends to upload. */
export interface UploadFileInput {
  name: string;
  size: number;
  contentType: string;
}

/** One uploaded multipart part reported back when completing a file. */
export interface CompletedPart {
  partNumber: number;
  etag: string;
}
