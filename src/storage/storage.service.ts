import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadBucketCommand,
  PutBucketPolicyCommand,
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
import { parsePositiveIntEnv } from '../common/env.js';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const PRESIGNED_URL_TTL_SECONDS = 3600;
const BUCKET_ENSURE_MAX_ATTEMPTS = 10;
const BUCKET_ENSURE_RETRY_DELAY_MS = 2000;

const DEFAULT_MAX_SOCKETS = 200;

/**
 * Cache-Control written on public, immutable image objects (cover art). Paired
 * with the versioned public URL (`?v=`), so a replaced image gets a fresh URL
 * and this long TTL never serves stale bytes. Exported for the album/artist
 * services that upload those objects.
 */
export const PUBLIC_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

interface StorageConfig {
  endpoint: string;
  presignedEndpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  privateBuckets: string[];
  publicBuckets: string[];
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
  cacheControl?: string;
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
        CacheControl: options.cacheControl,
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

  /**
   * Builds a stable, unsigned public URL for an object served from the public
   * storage host / CDN. Unlike {@link getPresignedUrl} it carries no SigV4
   * signature, so the URL is identical across requests and edge-cacheable; the
   * target bucket must be anonymous-read (see {@link ensurePublicReadPolicy}).
   * Pass `version` (e.g. the row's updatedAt) to append a `?v=` cache-buster so
   * replacing an object under a stable key yields a fresh, non-stale URL.
   */
  getPublicUrl(
    bucket: StorageBucket,
    key: string | null,
    version?: Date,
  ): string {
    this.assertKey(key);
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    const base = this.storageConfig.presignedEndpoint.replace(/\/+$/, '');
    const url = `${base}/${bucket}/${encodedKey}`;
    return version ? `${url}?v=${version.getTime()}` : url;
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
   * absorb storage startup lag; on final failure it logs and lets the app
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

  /**
   * Creates any of the configured buckets that don't already exist, then
   * (re)applies the anonymous-read policy to the public image buckets.
   */
  async ensureBuckets(): Promise<void> {
    for (const bucket of this.allBuckets()) {
      await this.ensureBucket(bucket);
    }
    for (const bucket of this.storageConfig.publicBuckets) {
      await this.ensurePublicReadPolicy(bucket);
    }
  }

  /**
   * Every configured bucket across access levels. Derived from the private and
   * public lists so "all buckets" always includes the public ones — the two
   * lists are the single source of truth for each bucket's visibility.
   */
  private allBuckets(): string[] {
    return [
      ...this.storageConfig.privateBuckets,
      ...this.storageConfig.publicBuckets,
    ];
  }

  /**
   * Grants anonymous read (s3:GetObject) on a bucket so its objects can be
   * fetched without a signature and cached at the edge/CDN. Idempotent and run
   * on every bootstrap: it heals buckets created before this policy existed and
   * restores a manually-cleared policy. Only the album-art / artist-image
   * buckets are made public; tracks stay private.
   */
  private async ensurePublicReadPolicy(bucket: string): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    };
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(policy),
      }),
    );
    this.logger.log(`Applied public-read policy to bucket "${bucket}"`);
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
      this.allBuckets().map((bucket) => this.checkBucket(bucket)),
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
    // Bucket names default to the StorageBucket enum's conventional names and
    // are only overridden when an env var is explicitly set. The enum is the
    // single source of truth: these defaults always match the names the rest
    // of the service reads/writes, so the ensure/health list can never drift.
    const tracksBucket =
      configService.get<string>('STORAGE_TRACKS_BUCKET') ||
      StorageBucket.Tracks;
    const albumArtBucket =
      configService.get<string>('STORAGE_ALBUM_ART_BUCKET') ||
      StorageBucket.AlbumArt;
    const artistImageBucket =
      configService.get<string>('STORAGE_ARTIST_IMAGE_BUCKET') ||
      StorageBucket.ArtistArt;

    if (
      !endpoint ||
      !region ||
      !accessKey ||
      !secretKey ||
      !presignedEndpoint
    ) {
      throw new Error('Storage configuration is incomplete');
    }

    return {
      endpoint,
      presignedEndpoint,
      region,
      accessKey,
      secretKey,
      privateBuckets: [tracksBucket],
      publicBuckets: [albumArtBucket, artistImageBucket],
      maxSockets: parsePositiveIntEnv(
        configService.get<string>('STORAGE_MAX_SOCKETS'),
        DEFAULT_MAX_SOCKETS,
        'STORAGE_MAX_SOCKETS',
      ),
    };
  }
}
