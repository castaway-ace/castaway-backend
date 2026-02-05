import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { StorageUploadResult } from './storage.types.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    @Inject('MINIO_CLIENT') private readonly minioClient: Minio.Client,
    @Inject('MINIO_PUBLIC_CLIENT')
    private readonly minioPublicClient: Minio.Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>(
      'storage.bucketName',
      'castaway-audio',
    );
    this.region = this.configService.get<string>('storage.region', 'us-west-2');
  }

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

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<StorageUploadResult> {
    try {
      const metaData = {
        'Content-Type': contentType,
        ...metadata,
      };

      const uploadInfo = await this.minioClient.putObject(
        this.bucketName,
        key,
        buffer,
        buffer.length,
        metaData,
      );

      return {
        storageKey: key,
        size: buffer.length,
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
      const url = await this.minioPublicClient.presignedGetObject(
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
