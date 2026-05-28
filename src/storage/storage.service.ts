import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageBucket } from '../types/storage.js';
import { Readable } from 'stream';

interface StorageConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

export interface PutObjectOptions {
  contentType: string;
  size?: number;
  metadata?: Record<string, string>;
}

export interface ObjectStreamResult {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
}

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly storageConfig: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.storageConfig = this.loadStorageConfig(configService);
    this.client = new S3Client({
      endpoint: this.storageConfig.endpoint,
      region: this.storageConfig.region ?? 'us-east-1',
      credentials: {
        accessKeyId: this.storageConfig.accessKey,
        secretAccessKey: this.storageConfig.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async putObject(
    bucket: StorageBucket,
    key: string,
    body: Buffer | Readable,
    options: PutObjectOptions,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ContentLength: options.size,
        Metadata: options.metadata,
      }),
    );
  }

  async getObjectStream(
    bucket: StorageBucket,
    key: string | null,
    range?: string,
  ): Promise<ObjectStreamResult> {
    if (!key) {
      throw new Error(`Key is not provided`);
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: range,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object has no body: ${key}`);
    }

    if (!(response.Body instanceof Readable)) {
      throw new Error(
        `Expected Node Readable stream for object: ${key}. ` +
          `Got ${response.Body.constructor.name}.`,
      );
    }

    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges,
    };
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof S3ServiceException) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return false;
        }
      }
      throw err;
    }
  }

  async deleteObject(bucket: StorageBucket, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  private loadStorageConfig(configService: ConfigService): StorageConfig {
    const endpoint = configService.get<string>('STORAGE_ENDPOINT');
    const region = configService.get<string>('STORAGE_REGION');
    const accessKey = configService.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = configService.get<string>('STORAGE_SECRET_ACCESS_KEY');

    if (!endpoint || !region || !accessKey || !secretKey) {
      throw new Error('JWT configuration is incomplete');
    }

    return {
      endpoint,
      region,
      accessKey,
      secretKey,
    };
  }
}
