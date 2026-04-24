import { registerAs } from '@nestjs/config';
import z from 'zod';

const schema = z.object({
  endpoint: z.url(),
  accessKey: z.string(),
  secretKey: z.string(),
  region: z.string().optional(),
  forcePathStyle: z.boolean(),
  trackBucket: z.string(),
  albumArtBucket: z.string(),
  artistArtBucket: z.string(),
});

export type StorageConfig = z.infer<typeof schema>;

export const storageConfig = registerAs('storage', (): StorageConfig => {
  return schema.parse({
    endpoint: process.env.STORAGE_ENDPOINT,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    region: process.env.STORAGE_REGION,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
    trackBucket: process.env.STORAGE_BUCKET_TRACKS,
    albumArtBucket: process.env.STORAGE_BUCKET_ALBUM_ART,
    artistArtBucket: process.env.STORAGE_BUCKET_ARTIST_ART,
});
});