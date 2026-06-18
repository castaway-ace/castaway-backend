import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageBucket } from '../types/storage.js';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PRESIGNED_URL_TTL_SECONDS = 3600;

interface StorageConfig {
  endpoint: string;
  presignedEndpoint: string;
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

    let response;
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
      if (this.isNotFound(err)) {
        return false;
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

  private createClient(endpoint: string): S3Client {
    return new S3Client({
      endpoint,
      region: this.storageConfig.region,
      credentials: {
        accessKeyId: this.storageConfig.accessKey,
        secretAccessKey: this.storageConfig.secretKey,
      },
      forcePathStyle: true,
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

  private loadStorageConfig(configService: ConfigService): StorageConfig {
    const endpoint = configService.get<string>('STORAGE_ENDPOINT');
    const presignedEndpoint = configService.get<string>(
      'STORAGE_PRESIGNED_ENDPOINT',
    );
    const region = configService.get<string>('STORAGE_REGION');
    const accessKey = configService.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = configService.get<string>('STORAGE_SECRET_ACCESS_KEY');

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
    };
  }
}
