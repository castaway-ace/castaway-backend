import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadBucketCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  UploadPartCommand,
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
  publicBaseUrl: string;
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

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface HeadObjectResult {
  contentLength: number;
  contentType?: string;
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
    const base = this.storageConfig.publicBaseUrl.replace(/\/+$/, '');
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
   * Initiates a multipart upload and returns its UploadId. Callers presign the
   * individual part URLs (see `presignUploadPart`) and complete the upload with
   * `completeMultipartUpload` once every part has been stored.
   */
  async createMultipartUpload(
    bucket: StorageBucket,
    key: string,
    contentType: string,
  ): Promise<string> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
    );

    if (!response.UploadId) {
      throw new InternalServerErrorException(
        `Multipart upload was not initiated for ${key}`,
      );
    }

    return response.UploadId;
  }

  /** Finalizes a multipart upload. Parts are sorted ascending as S3 requires. */
  async completeMultipartUpload(
    bucket: StorageBucket,
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ): Promise<void> {
    const orderedParts = [...parts]
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag }));

    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: orderedParts },
      }),
    );
  }

  /** Cancels an in-flight multipart upload and discards its stored parts. */
  async abortMultipartUpload(
    bucket: StorageBucket,
    key: string,
    uploadId: string,
  ): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  /**
   * Presigns a single-part PUT URL against the client-reachable endpoint so a
   * caller can upload one object directly to storage.
   */
  async presignPutObject(
    bucket: StorageBucket,
    key: string,
    contentType: string,
    expiresIn: number = PRESIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.preSignedClient,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );
  }

  /**
   * Presigns an UploadPart URL against the client-reachable endpoint. Signing
   * is a local HMAC operation (no round trip), so callers can issue every part
   * URL for a session up front.
   */
  async presignUploadPart(
    bucket: StorageBucket,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn: number = PRESIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    return getSignedUrl(
      this.preSignedClient,
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn },
    );
  }

  /** Returns object metadata, mapping a missing object to NotFoundException. */
  async headObject(
    bucket: StorageBucket,
    key: string,
  ): Promise<HeadObjectResult> {
    let response: HeadObjectCommandOutput;
    try {
      response = await this.client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (err) {
      if (this.isNotFound(err)) {
        throw new NotFoundException(`Object not found: ${key}`);
      }
      throw err;
    }

    if (response.ContentLength === undefined) {
      throw new InternalServerErrorException(
        `Object has no content length: ${key}`,
      );
    }

    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  /**
   * Server-side copy between buckets so bytes never transit the app/worker.
   * When `contentType` is given it is written on the destination
   * (MetadataDirective REPLACE); otherwise the source's metadata is preserved.
   */
  async copyObject(
    srcBucket: StorageBucket,
    srcKey: string,
    dstBucket: StorageBucket,
    dstKey: string,
    contentType?: string,
  ): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: dstBucket,
        Key: dstKey,
        CopySource: this.encodeCopySource(srcBucket, srcKey),
        ...(contentType
          ? { ContentType: contentType, MetadataDirective: 'REPLACE' }
          : {}),
      }),
    );
  }

  /**
   * Best-effort recursive delete of every object under `prefix`. Never throws:
   * used by upload-session abort/cleanup paths. Individual object failures are
   * logged via `deleteObjectQuietly`; a failed listing aborts quietly.
   */
  async deletePrefix(bucket: StorageBucket, prefix: string): Promise<void> {
    let continuationToken: string | undefined;

    do {
      let page: ListObjectsV2CommandOutput;
      try {
        page = await this.client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );
      } catch (error) {
        this.logger.warn(
          `Failed to list objects under ${bucket}/${prefix}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }

      for (const object of page.Contents ?? []) {
        if (object.Key) {
          await this.deleteObjectQuietly(
            bucket,
            object.Key,
            `prefix ${prefix}`,
          );
        }
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  /**
   * Builds an S3 CopySource for path-style access: the bucket, then the key
   * with each path segment percent-encoded while the `/` separators are kept.
   */
  private encodeCopySource(bucket: string, key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${bucket}/${encodedKey}`;
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
   * buckets are made public; tracks and staging stay private.
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
    const stagingBucket =
      configService.get<string>('STORAGE_STAGING_BUCKET') ||
      StorageBucket.Staging;

    if (
      !endpoint ||
      !region ||
      !accessKey ||
      !secretKey ||
      !presignedEndpoint
    ) {
      throw new Error('Storage configuration is incomplete');
    }

    // Public (unsigned) base host for edge-cacheable cover art. Defaults to the
    // presigned endpoint so a single storage host works out of the box; set
    // CDN_BASE_URL to point cover-art URLs at a dedicated CDN hostname.
    const publicBaseUrl =
      configService.get<string>('CDN_BASE_URL') || presignedEndpoint;

    return {
      endpoint,
      presignedEndpoint,
      publicBaseUrl,
      region,
      accessKey,
      secretKey,
      privateBuckets: [tracksBucket, stagingBucket],
      publicBuckets: [albumArtBucket, artistImageBucket],
      maxSockets: parsePositiveIntEnv(
        configService.get<string>('STORAGE_MAX_SOCKETS'),
        DEFAULT_MAX_SOCKETS,
        'STORAGE_MAX_SOCKETS',
      ),
    };
  }
}
