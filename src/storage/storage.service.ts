import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { StorageUploadResult } from './storage.types.js';
import { StorageConfig } from 'src/config/config.types.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly region: string;
  private readonly publicEndPoint?: string;
  private readonly publicPort?: number;
  private readonly publicUseSSL?: boolean;

  constructor(
    @Inject('MINIO_CLIENT') private readonly client: Minio.Client,
    private readonly config: ConfigService,
  ) {
    const storageConfig = this.config.get<StorageConfig>('storage');
    if (!storageConfig) {
      throw new Error('Storage configuration not found');
    }

    this.bucketName = storageConfig.bucketName;
    this.region = storageConfig.region;
    this.publicEndPoint = storageConfig.publicEndPoint;
    this.publicPort = storageConfig.publicPort;
    this.publicUseSSL = storageConfig.publicUseSSL;
  }

  async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);

      if (!exists) {
        await this.client.makeBucket(this.bucketName, this.region);
        this.logger.log(`Bucket "${this.bucketName}" created successfully`);
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

      const uploadInfo = await this.client.putObject(
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
      const stream = await this.client.getObject(this.bucketName, storageKey);
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
      const stream = await this.client.getPartialObject(
        this.bucketName,
        storageKey,
        offset,
        length,
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
      const stats = await this.client.statObject(this.bucketName, storageKey);
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
      await this.client.removeObject(this.bucketName, storageKey);
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
      await this.client.statObject(this.bucketName, storageKey);
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
  async getPresignedUrl(key: string, expiry: number): Promise<string> {
    const internalUrl = await this.client.presignedGetObject(
      this.bucketName,
      key,
      expiry,
    );

    if (!this.publicEndPoint) {
      return internalUrl;
    }

    const url = new URL(internalUrl);
    url.hostname = this.publicEndPoint;
    url.port = String(this.publicPort ?? url.port);
    url.protocol = this.publicUseSSL ? 'https:' : 'http:';

    return url.toString();
  }
}
