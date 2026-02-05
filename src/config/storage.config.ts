import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  accessKey: process.env.MINIO_ROOT_USER || '',
  secretKey: process.env.MINIO_ROOT_PASSWORD || '',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  bucketName: process.env.MINIO_BUCKET_NAME || 'castaway-audio',
  region: process.env.MINIO_REGION || 'us-west-2',
  publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT,
  publicPort: parseInt(process.env.MINIO_PUBLIC_PORT || '443', 10),
  publicUseSSL: process.env.MINIO_PUBLIC_USE_SSL === 'true',
}));
