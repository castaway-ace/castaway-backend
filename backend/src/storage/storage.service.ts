import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    @Inject('MINIO_CLIENT') private readonly minioClient: Minio.Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('storage.bucketName', 'castaway-audio');
    this.region = this.configService.get<string>(
      'storage.region',
      'us-west-2',
    );
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
        
        // Set bucket policy to allow public read access for audio files
        await this.setBucketPolicy();
      } else {
        this.logger.log(`Bucket "${this.bucketName}" already exists`);
      }
    } catch (error) {
      this.logger.error(`Error ensuring bucket exists: ${error.message}`);
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
      this.logger.warn(`Could not set bucket policy: ${error.message}`);
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
  async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ bucket: string; fileName: string; size: number }> {
    try {
      const metaData = {
        'Content-Type': contentType,
        ...metadata,
      };

      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        fileBuffer,
        fileBuffer.length,
        metaData,
      );

      this.logger.log(`File "${fileName}" uploaded successfully`);

      return {
        bucket: this.bucketName,
        fileName,
        size: fileBuffer.length,
      };
    } catch (error) {
      this.logger.error(`Error uploading file "${fileName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets a file from MinIO
   * @param fileName - Name of the file to retrieve
   * @returns Readable stream of the file
   */
  async getFile(fileName: string): Promise<Readable> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, fileName);
      this.logger.log(`Retrieved file "${fileName}"`);
      return stream;
    } catch (error) {
      this.logger.error(`Error getting file "${fileName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets file metadata without downloading the file
   * @param fileName - Name of the file
   * @returns File statistics including size, ETag, and metadata
   */
  async getFileStats(fileName: string): Promise<Minio.BucketItemStat> {
    try {
      const stats = await this.minioClient.statObject(this.bucketName, fileName);
      return stats;
    } catch (error) {
      this.logger.error(`Error getting file stats for "${fileName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a file from MinIO
   * @param fileName - Name of the file to delete
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, fileName);
      this.logger.log(`File "${fileName}" deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting file "${fileName}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Lists all files in the bucket with optional prefix filter
   * @param prefix - Optional prefix to filter files
   * @returns Array of file information
   */
  async listFiles(prefix?: string): Promise<Minio.BucketItem[]> {
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
          this.logger.log(`Listed ${files.length} files`);
          resolve(files);
        });
      });
    } catch (error) {
      this.logger.error(`Error listing files: ${error.message}`);
      throw error;
    }
  }

  /**
   * Checks if a file exists in the bucket
   * @param fileName - Name of the file to check
   * @returns True if file exists, false otherwise
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, fileName);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}