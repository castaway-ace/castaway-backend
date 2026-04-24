import {
    HeadObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
    S3ServiceException,
    HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { StorageConfig } from '../config/storage.config.js';

export enum StorageBucket {
    Tracks = 'TRACKS',
    AlbumArt = 'ALBUM_ART',
    ArtistArt = 'ARTIST_ART',
}

export interface PutObjectOptions {
    contentType: string;
    size?: number;
    metadata?: Record<string, string>;
}

export interface GetStreamOptions {
    range?: string;
}

export interface ObjectMetadata {
    size: number;
    contentType: string;
    etag: string;
    lastModified: Date;
}

@Injectable()
export class StorageService implements OnModuleInit {
    private readonly logger = new Logger(StorageService.name);
    private readonly client: S3Client;
    private readonly bucketNames: Record<StorageBucket, string>;
    private readonly endpoint: string;

    constructor(private readonly config: ConfigService) {
        const storage = this.config.getOrThrow<StorageConfig>('storage');
        this.client = new S3Client({
            endpoint: storage.endpoint,
            region: storage.region ?? 'us-east-1',
            credentials: {
                accessKeyId: storage.accessKey,
                secretAccessKey: storage.secretKey,
            },
            forcePathStyle: storage.forcePathStyle,
        });

        this.bucketNames = {
            [StorageBucket.Tracks]: storage.trackBucket,
            [StorageBucket.AlbumArt]: storage.albumArtBucket,
            [StorageBucket.ArtistArt]: storage.artistArtBucket,
        };

        this.endpoint = storage.endpoint;
    }

    async onModuleInit(): Promise<void> {
        const bucketNames = Object.values(StorageBucket).map((b) => this.resolveBucket(b));

        let results: { name: string; exists: boolean }[];
        try {
          results = await Promise.all(
            bucketNames.map(async (name) => ({
              name,
              exists: await this.bucketExists(name),
            })),
          );
        } catch (error) {
          if (this.isConnectionError(error)) {
            throw new Error(
              `Cannot connect to storage at ${this.endpoint}.`
            );
          }
          throw error;
        }

        const missing = results.filter((r) => !r.exists).map((r) => r.name);
        for (const result of results) {
          if (result.exists) {
            this.logger.log(`Bucket verified: ${result.name}`);
          }
        }
        if (missing.length > 0) {
          throw new Error(
            `Missing required storage buckets: ${missing.join(', ')}. ` +
            `Provision them before starting the application.`,
          );
        }
    }

    async putObject(
        bucket: StorageBucket,
        key: string,
        body: Buffer | Readable,
        options: PutObjectOptions,
    ): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.resolveBucket(bucket),
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
        key: string,
        options?: GetStreamOptions,
    ): Promise<Readable> {
        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.resolveBucket(bucket),
                Key: key,
                Range: options?.range,
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

    async getObjectMetadata(bucket: StorageBucket, key: string): Promise<ObjectMetadata> {
        const response = await this.client.send(
            new HeadObjectCommand({
                Bucket: this.resolveBucket(bucket),
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
                Bucket: this.resolveBucket(bucket),
                Key: key,
            }),
        );
    }

    async objectExists(bucket: StorageBucket, key: string): Promise<boolean> {
        try {
            await this.getObjectMetadata(bucket, key);
            return true;
        } catch (error) {
            if (this.isObjectMissing(error)) {
                return false;
            }
            throw error;
        }
    }

    private resolveBucket(bucket: StorageBucket): string {
        return this.bucketNames[bucket];
    }

    private async bucketExists(name: string): Promise<boolean> {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: name }));
            return true;
        } catch (error) {
            if (this.isBucketMissing(error)) {
                return false;
            }
            throw error;
        }
    }

    private isObjectMissing(error: unknown): boolean {
        return (
            error instanceof S3ServiceException &&
            (error.name === 'NotFound' || error.name === 'NoSuchKey')
        );
    }

    private isBucketMissing(error: unknown): boolean {
        if (!(error instanceof S3ServiceException)) {
            return false;
        }
        return (
            error.name === 'NoSuchBucket' ||
            error.name === 'NotFound' ||
            error.$metadata.httpStatusCode === 404
        );
    }

    private isConnectionError(error: unknown): boolean {
        if (typeof error !== 'object' || error === null) {
          return false;
        }
        const err = error as { code?: string; cause?: { code?: string } };
        const code = err.code ?? err.cause?.code;
        return code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT';
      }
}
