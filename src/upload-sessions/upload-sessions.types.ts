/** How a single file is uploaded to staging. */
export type UploadMode = 'single' | 'multipart';

/** Validated descriptor of one file the client intends to upload. */
export interface UploadFileInput {
  name: string;
  size: number;
  contentType: string;
}
