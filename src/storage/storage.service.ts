import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

export interface TrackUploadResult {
  storageKey: string;
  size: number;
  etag: string;
}

export interface AlbumArtUploadResult {
  storageKey: string;
  size: number;
  etag: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly region: string;

  private readonly TRACK_PREFIX = 'tracks/';
  private readonly ALBUM_ART_PREFIX = 'album-art/';

  constructor(
    @Inject('MINIO_CLIENT') private readonly minioClient: Minio.Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>(
      'storage.bucketName',
      'castaway-audio',
    );
    this.region = this.configService.get<string>('storage.region', 'us-west-2');
  }

  /**
   * Ensures the bucket exists, creates it if it does not
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);

      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, this.region);
        this.logger.log(`Bucket "${this.bucketName}" created successfully`);

        await this.setBucketPolicy();
      } else {
        this.logger.log(`Bucket "${this.bucketName}" already exists`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error ensuring bucket exists: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Sets bucket policy for public read access
   * This allows audio files to be streamed without authentication
   */
  private async setBucketPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    };

    try {
      await this.minioClient.setBucketPolicy(
        this.bucketName,
        JSON.stringify(policy),
      );
      this.logger.log('Bucket policy set for public read access');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Could not set bucket policy: ${errorMessage}`);
    }
  }

  /**
   * Uploads a file to MinIO
   * @param fileName - Name to store the file as
   * @param fileBuffer - File content as Buffer
   * @param contentType - MIME type of the file
   * @param metadata - Optional metadata to attach to the file
   * @returns Object containing bucket name, file name, and size
   */
  async uploadTrack(
    checksum: string,
    fileExtension: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<TrackUploadResult> {
    const storageKey = `${this.TRACK_PREFIX}${checksum}.${fileExtension}`;

    try {
      const metaData = {
        'Content-Type': contentType,
        ...metadata,
      };

      const uploadInfo = await this.minioClient.putObject(
        this.bucketName,
        storageKey,
        fileBuffer,
        fileBuffer.length,
        metaData,
      );

      this.logger.log(`Track uploaded successfully: ${storageKey}`);

      return {
        storageKey,
        size: fileBuffer.length,
        etag: uploadInfo.etag,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error uploading track: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Uploads album art to MinIO
   * Checks if art with same checksum already exists to avoid duplicates
   * @param artChecksum - Checksum of the album art (for deduplication)
   * @param fileExtension - File extension (jpg, png, etc.)
   * @param imageBuffer - Image content as Buffer
   * @param contentType - MIME type of the image
   * @returns Storage key, size, and etag
   */
  async uploadAlbumArt(
    artChecksum: string,
    fileExtension: string,
    imageBuffer: Buffer,
    contentType: string,
  ): Promise<AlbumArtUploadResult> {
    const storageKey = `${this.ALBUM_ART_PREFIX}${artChecksum}.${fileExtension}`;

    try {
      // Check if this exact album art already exists
      const exists = await this.fileExists(storageKey);

      if (exists) {
        const stats = await this.getFileStats(storageKey);
        this.logger.log(`Album art already exists: ${storageKey}`);
        return {
          storageKey,
          size: stats.size,
          etag: stats.etag,
        };
      }

      // Upload new album art
      const metaData = {
        'Content-Type': contentType,
      };

      const uploadInfo = await this.minioClient.putObject(
        this.bucketName,
        storageKey,
        imageBuffer,
        imageBuffer.length,
        metaData,
      );

      this.logger.log(`Album art uploaded successfully: ${storageKey}`);

      return {
        storageKey,
        size: imageBuffer.length,
        etag: uploadInfo.etag,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error uploading album art: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Gets a file from MinIO by storage key
   * @param storageKey - Full storage key including prefix
   * @returns Readable stream of the file
   */
  async getFile(storageKey: string): Promise<Readable> {
    try {
      const stream = await this.minioClient.getObject(
        this.bucketName,
        storageKey,
      );
      this.logger.log(`Retrieved file: ${storageKey}`);
      return stream;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting file "${storageKey}": ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Gets a partial file from MinIO (for range requests)
   * @param storageKey - Full storage key including prefix
   * @param offset - Byte offset to start reading from
   * @param length - Number of bytes to read
   * @returns Readable stream of the file portion
   */
  async getFileRange(
    storageKey: string,
    offset: number,
    length: number,
  ): Promise<Readable> {
    try {
      const stream = await this.minioClient.getPartialObject(
        this.bucketName,
        storageKey,
        offset,
        length,
      );
      this.logger.log(
        `Retrieved partial file: ${storageKey} (${offset}-${offset + length})`,
      );
      return stream;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting partial file "${storageKey}": ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Gets file metadata without downloading the file
   * @param storageKey - Full storage key including prefix
   * @returns File statistics including size, ETag, and metadata
   */
  async getFileStats(storageKey: string): Promise<Minio.BucketItemStat> {
    try {
      const stats = await this.minioClient.statObject(
        this.bucketName,
        storageKey,
      );
      return stats;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error getting file stats for "${storageKey}": ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Deletes a file from MinIO
   * @param storageKey - Full storage key including prefix
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, storageKey);
      this.logger.log(`File deleted successfully: ${storageKey}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error deleting file "${storageKey}": ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Lists all track files
   * @returns Array of file information
   */
  async listTracks(): Promise<Minio.BucketItem[]> {
    return this.listFiles(this.TRACK_PREFIX);
  }

  /**
   * Lists all album art files
   * @returns Array of file information
   */
  async listAlbumArt(): Promise<Minio.BucketItem[]> {
    return this.listFiles(this.ALBUM_ART_PREFIX);
  }

  /**
   * Lists files with optional prefix filter
   * @param prefix - Optional prefix to filter files
   * @returns Array of file information
   */
  private async listFiles(prefix?: string): Promise<Minio.BucketItem[]> {
    try {
      const stream = this.minioClient.listObjects(
        this.bucketName,
        prefix,
        true, // recursive
      );

      const files: Minio.BucketItem[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (obj: Minio.BucketItem) => files.push(obj));
        stream.on('error', reject);
        stream.on('end', () => {
          this.logger.log(
            `Listed ${files.length} files${prefix ? ` with prefix "${prefix}"` : ''}`,
          );
          resolve(files);
        });
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing files: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Checks if a file exists in the bucket
   * @param storageKey - Full storage key including prefix
   * @returns True if file exists, false otherwise
   */
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, storageKey);
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'NotFound'
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generates a presigned URL for temporary access to a file
   * Useful for mobile apps to download files directly from MinIO
   * @param storageKey - Full storage key including prefix
   * @param expirySeconds - URL expiry time in seconds (default: 24 hours)
   * @returns Presigned URL
   */
  async getPresignedUrl(
    storageKey: string,
    expirySeconds: number = 86400,
  ): Promise<string> {
    try {
      const url = await this.minioClient.presignedGetObject(
        this.bucketName,
        storageKey,
        expirySeconds,
      );
      return url;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error generating presigned URL for "${storageKey}": ${errorMessage}`,
      );
      throw error;
    }
  }
}
