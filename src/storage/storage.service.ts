import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageBucket } from './storage.types.js';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const PRESIGNED_URL_TTL_SECONDS = 3600;
const BUCKET_ENSURE_MAX_ATTEMPTS = 10;
const BUCKET_ENSURE_RETRY_DELAY_MS = 2000;

const DEFAULT_MAX_SOCKETS = 200;

interface StorageConfig {
  endpoint: string;
  presignedEndpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  buckets: string[];
  maxSockets: number;
}

export interface BucketHealth {
  bucket: string;
  healthy: boolean;
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
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly preSignedClient: S3Client;
  private readonly storageConfig: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.storageConfig = this.loadStorageConfig(configService);
    this.client = this.createClient(this.storageConfig.endpoint);
    this.preSignedClient = this.createClient(
      this.storageConfig.presignedEndpoint,
    );
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
    this.assertKey(key);

    let response: GetObjectCommandOutput;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }),
      );
    } catch (err) {
      if (this.isNotFound(err)) {
        throw new NotFoundException(`Object not found: ${key}`);
      }
      throw err;
    }

    if (!response.Body) {
      throw new InternalServerErrorException(`Object has no body: ${key}`);
    }

    if (!(response.Body instanceof Readable)) {
      throw new InternalServerErrorException(
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

  async getPresignedUrl(
    bucket: StorageBucket,
    key: string | null,
  ): Promise<string> {
    this.assertKey(key);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.preSignedClient, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });
  }

  async deleteObject(bucket: StorageBucket, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  /**
   * Best-effort delete used for cleanup paths (rollbacks, orphaned objects).
   * Never throws: failures are logged as warnings so they don't mask the
   * original error or abort the surrounding operation. `context` describes the
   * caller (e.g. "cover for album abc") to make warnings actionable.
   */
  async deleteObjectQuietly(
    bucket: StorageBucket,
    key: string,
    context?: string,
  ): Promise<void> {
    try {
      await this.deleteObject(bucket, key);
    } catch (error) {
      const suffix = context ? ` (${context})` : '';
      this.logger.warn(
        `Failed to delete object ${key} from ${bucket}${suffix}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Ensure the required buckets exist once the app has started. Retries to
   * absorb MinIO/S3 startup lag; on final failure it logs and lets the app
   * start anyway (the /health check reports storage status).
   */
  async onApplicationBootstrap(): Promise<void> {
    for (let attempt = 1; attempt <= BUCKET_ENSURE_MAX_ATTEMPTS; attempt++) {
      try {
        await this.ensureBuckets();
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt === BUCKET_ENSURE_MAX_ATTEMPTS) {
          this.logger.error(
            `Could not ensure storage buckets after ${attempt} attempts: ${message}. ` +
              `Continuing startup; /health will report storage status.`,
          );
          return;
        }
        this.logger.warn(
          `Storage not ready (attempt ${attempt}/${BUCKET_ENSURE_MAX_ATTEMPTS}): ${message}; ` +
            `retrying in ${BUCKET_ENSURE_RETRY_DELAY_MS}ms`,
        );
        await this.delay(BUCKET_ENSURE_RETRY_DELAY_MS);
      }
    }
  }

  /** Creates any of the configured buckets that don't already exist. */
  async ensureBuckets(): Promise<void> {
    for (const bucket of this.storageConfig.buckets) {
      await this.ensureBucket(bucket);
    }
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch (err) {
      if (!this.isNotFound(err)) throw err;
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Created storage bucket "${bucket}"`);
    } catch (err) {
      if (this.isBucketAlreadyOwned(err)) return;
      throw err;
    }
  }

  async checkBuckets(): Promise<BucketHealth[]> {
    return Promise.all(
      this.storageConfig.buckets.map((bucket) => this.checkBucket(bucket)),
    );
  }

  private async checkBucket(bucket: string): Promise<BucketHealth> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { bucket, healthy: true };
    } catch (err) {
      this.logger.warn(
        `Bucket health check failed for "${bucket}": ` +
          `${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return { bucket, healthy: false };
    }
  }

  private createClient(endpoint: string): S3Client {
    const { maxSockets } = this.storageConfig;
    return new S3Client({
      endpoint,
      region: this.storageConfig.region,
      credentials: {
        accessKeyId: this.storageConfig.accessKey,
        secretAccessKey: this.storageConfig.secretKey,
      },
      forcePathStyle: true,
      requestHandler: new NodeHttpHandler({
        httpAgent: new HttpAgent({ keepAlive: true, maxSockets }),
        httpsAgent: new HttpsAgent({ keepAlive: true, maxSockets }),
      }),
    });
  }

  private assertKey(key: string | null): asserts key is string {
    if (!key) {
      throw new NotFoundException('Object key is missing');
    }
  }

  private isNotFound(err: unknown): boolean {
    return (
      err instanceof S3ServiceException &&
      (err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404)
    );
  }

  private isBucketAlreadyOwned(err: unknown): boolean {
    return (
      err instanceof S3ServiceException &&
      (err.name === 'BucketAlreadyOwnedByYou' ||
        err.name === 'BucketAlreadyExists')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private loadStorageConfig(configService: ConfigService): StorageConfig {
    const endpoint = configService.get<string>('STORAGE_ENDPOINT');
    const presignedEndpoint = configService.get<string>(
      'STORAGE_PRESIGNED_ENDPOINT',
    );
    const region = configService.get<string>('STORAGE_REGION');
    const accessKey = configService.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = configService.get<string>('STORAGE_SECRET_ACCESS_KEY');
    const tracksBucket = configService.get<string>('STORAGE_TRACKS_BUCKET');
    const albumArtBucket = configService.get<string>(
      'STORAGE_ALBUM_ART_BUCKET',
    );
    const artistImageBucket = configService.get<string>(
      'STORAGE_ARTIST_IMAGE_BUCKET',
    );

    if (
      !endpoint ||
      !region ||
      !accessKey ||
      !secretKey ||
      !presignedEndpoint ||
      !tracksBucket ||
      !albumArtBucket ||
      !artistImageBucket
    ) {
      throw new Error('Storage configuration is incomplete');
    }

    return {
      endpoint,
      presignedEndpoint,
      region,
      accessKey,
      secretKey,
      buckets: [tracksBucket, albumArtBucket, artistImageBucket],
      maxSockets: this.parseMaxSockets(
        configService.get<string>('STORAGE_MAX_SOCKETS'),
      ),
    };
  }

  private parseMaxSockets(raw: string | undefined): number {
    if (raw === undefined || raw === '') {
      return DEFAULT_MAX_SOCKETS;
    }

    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `Invalid STORAGE_MAX_SOCKETS "${raw}": expected a positive integer`,
      );
    }

    return value;
  }
}
