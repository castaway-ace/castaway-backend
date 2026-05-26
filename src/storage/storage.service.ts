import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
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

export interface ObjectMetadata {
  size: number;
  contentType: string;
  etag: string;
  lastModified: Date;
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
  ): Promise<Readable> {
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

    return response.Body;
  }

  async getObjectMetadata(
    bucket: StorageBucket,
    key: string,
  ): Promise<ObjectMetadata> {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (response.ContentLength === undefined) {
      throw new Error(`Object metadata missing ContentLength: ${key}`);
    }
    if (response.ContentType === undefined) {
      throw new Error(`Object metadata missing ContentType: ${key}`);
    }
    if (response.ETag === undefined) {
      throw new Error(`Object metadata missing ETag: ${key}`);
    }
    if (response.LastModified === undefined) {
      throw new Error(`Object metadata missing LastModified: ${key}`);
    }

    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      etag: response.ETag,
      lastModified: response.LastModified,
    };
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
