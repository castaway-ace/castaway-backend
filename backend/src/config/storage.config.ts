import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  accessKey: process.env.MINIO_ROOT_USER || '',
  secretKey: process.env.MINIO_ROOT_PASSWORD || '',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  bucketName: process.env.MINIO_BUCKET_NAME || 'castaway-audio',
  region: process.env.MINIO_REGION || 'us-west-2',
}));
