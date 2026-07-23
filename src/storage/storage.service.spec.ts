import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { StorageService } from './storage.service.js';
import { StorageBucket } from './storage.types.js';

type SendMock = jest.Mock<(command: unknown) => Promise<unknown>>;

const configValues: Readonly<Record<string, unknown>> = {
  STORAGE_ENDPOINT: 'https://internal.example.com',
  STORAGE_PRESIGNED_ENDPOINT: 'https://public.example.com',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'access-key',
  STORAGE_SECRET_ACCESS_KEY: 'secret-access-key',
  STORAGE_TRACKS_BUCKET: 'tracks',
  STORAGE_ALBUM_ART_BUCKET: 'album-art',
  STORAGE_ARTIST_IMAGE_BUCKET: 'artist-image',
  STORAGE_STAGING_BUCKET: 'upload-staging',
};

function makeS3Error(name: string, httpStatusCode: number): S3ServiceException {
  return new S3ServiceException({
    name,
    $fault: 'client',
    $metadata: { httpStatusCode },
    message: name,
  });
}

describe('StorageService', () => {
  let storageService: StorageService;
  let send: SendMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string): unknown => configValues[key]),
          },
        },
      ],
    }).compile();

    storageService = module.get(StorageService);
    send = jest.spyOn(S3Client.prototype, 'send') as unknown as SendMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getObjectStream', () => {
    it('throws NotFoundException for a null key without calling the client', async () => {
      await expect(
        storageService.getObjectStream(StorageBucket.Tracks, null),
      ).rejects.toThrow(NotFoundException);
      expect(send).not.toHaveBeenCalled();
    });

    it('returns the stream and metadata on success', async () => {
      const body = Readable.from(Buffer.from('audio'));
      send.mockResolvedValue({
        Body: body,
        ContentType: 'audio/flac',
        ContentLength: 5,
        ContentRange: 'bytes 0-4/5',
        AcceptRanges: 'bytes',
      });

      const result = await storageService.getObjectStream(
        StorageBucket.Tracks,
        'track-1/song.flac',
        'bytes=0-4',
      );

      expect(result).toEqual({
        stream: body,
        contentType: 'audio/flac',
        contentLength: 5,
        contentRange: 'bytes 0-4/5',
        acceptRanges: 'bytes',
      });

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      if (command instanceof GetObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Tracks,
          Key: 'track-1/song.flac',
          Range: 'bytes=0-4',
        });
      }
    });

    it('maps a not-found S3 error to NotFoundException', async () => {
      send.mockRejectedValue(makeS3Error('NoSuchKey', 404));

      await expect(
        storageService.getObjectStream(StorageBucket.Tracks, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rethrows a non-not-found error unchanged', async () => {
      const failure = new Error('connection reset');
      send.mockRejectedValue(failure);

      await expect(
        storageService.getObjectStream(StorageBucket.Tracks, 'track-1'),
      ).rejects.toBe(failure);
    });

    it('throws InternalServerErrorException when the response has no body', async () => {
      send.mockResolvedValue({});

      await expect(
        storageService.getObjectStream(StorageBucket.Tracks, 'track-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when the body is not a Node stream', async () => {
      send.mockResolvedValue({ Body: 'not-a-stream' });

      await expect(
        storageService.getObjectStream(StorageBucket.Tracks, 'track-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getPresignedUrl', () => {
    it('throws NotFoundException for a null key', async () => {
      await expect(
        storageService.getPresignedUrl(StorageBucket.AlbumArt, null),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('putObject', () => {
    it('sends a PutObjectCommand with the body and options', async () => {
      send.mockResolvedValue({});
      const body = Buffer.from('data');

      await storageService.putObject(StorageBucket.Tracks, 'track-1', body, {
        contentType: 'audio/flac',
        size: 4,
        metadata: { originalName: 'song.flac' },
      });

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      if (command instanceof PutObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Tracks,
          Key: 'track-1',
          Body: body,
          ContentType: 'audio/flac',
          ContentLength: 4,
          Metadata: { originalName: 'song.flac' },
        });
      }
    });
  });

  describe('deleteObject', () => {
    it('sends a DeleteObjectCommand for the key', async () => {
      send.mockResolvedValue({});

      await storageService.deleteObject(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      if (command instanceof DeleteObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.AlbumArt,
          Key: 'album-1/cover.jpg',
        });
      }
    });
  });

  describe('deleteObjectQuietly', () => {
    it('deletes the object on the happy path', async () => {
      send.mockResolvedValue({});

      await storageService.deleteObjectQuietly(
        StorageBucket.Tracks,
        'track-1/song.flac',
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
    });

    it('swallows failures and logs a warning instead of throwing', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      send.mockRejectedValue(new Error('bucket unreachable'));

      await expect(
        storageService.deleteObjectQuietly(
          StorageBucket.AlbumArt,
          'album-1/cover.jpg',
          'cover for album-1',
        ),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('album-1/cover.jpg');
      expect(warn.mock.calls[0][0]).toContain('cover for album-1');
    });
  });

  describe('checkBuckets', () => {
    it('reports every bucket healthy when each head succeeds', async () => {
      send.mockResolvedValue({});

      const result = await storageService.checkBuckets();

      expect(result).toEqual([
        { bucket: 'tracks', healthy: true },
        { bucket: 'album-art', healthy: true },
        { bucket: 'artist-image', healthy: true },
        { bucket: 'upload-staging', healthy: true },
      ]);
    });

    it('marks only the failing bucket unhealthy and does not throw', async () => {
      send.mockImplementation((command) => {
        if (
          command instanceof HeadBucketCommand &&
          command.input.Bucket === 'album-art'
        ) {
          return Promise.reject(new Error('bucket missing'));
        }
        return Promise.resolve({});
      });

      const result = await storageService.checkBuckets();

      expect(result).toEqual([
        { bucket: 'tracks', healthy: true },
        { bucket: 'album-art', healthy: false },
        { bucket: 'artist-image', healthy: true },
        { bucket: 'upload-staging', healthy: true },
      ]);
    });
  });

  describe('maxSockets configuration', () => {
    const buildService = async (
      overrides: Record<string, unknown>,
    ): Promise<StorageService> => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(
                (key: string): unknown =>
                  ({ ...configValues, ...overrides })[key],
              ),
            },
          },
        ],
      }).compile();
      return module.get(StorageService);
    };

    const resolvedMaxSockets = (service: StorageService): number =>
      (service as unknown as { storageConfig: { maxSockets: number } })
        .storageConfig.maxSockets;

    it('defaults to 200 sockets when STORAGE_MAX_SOCKETS is unset', async () => {
      const service = await buildService({});
      expect(resolvedMaxSockets(service)).toBe(200);
    });

    it('honors a valid STORAGE_MAX_SOCKETS override', async () => {
      const service = await buildService({ STORAGE_MAX_SOCKETS: '500' });
      expect(resolvedMaxSockets(service)).toBe(500);
    });

    it.each(['abc', '0', '-5', '2.5'])(
      'rejects a non-positive-integer STORAGE_MAX_SOCKETS (%s)',
      async (bad) => {
        await expect(
          buildService({ STORAGE_MAX_SOCKETS: bad }),
        ).rejects.toThrow('Invalid STORAGE_MAX_SOCKETS');
      },
    );
  });

  describe('bucket name defaults', () => {
    const connectionOnly: Readonly<Record<string, unknown>> = {
      STORAGE_ENDPOINT: 'https://internal.example.com',
      STORAGE_PRESIGNED_ENDPOINT: 'https://public.example.com',
      STORAGE_REGION: 'us-east-1',
      STORAGE_ACCESS_KEY: 'access-key',
      STORAGE_SECRET_ACCESS_KEY: 'secret-access-key',
    };

    const buildService = (
      values: Record<string, unknown>,
    ): Promise<TestingModule> =>
      Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string): unknown => values[key]) },
          },
        ],
      }).compile();

    const resolvedBuckets = (module: TestingModule): string[] =>
      module.get(StorageService).storageConfig.buckets;

    it('falls back to the StorageBucket enum names when bucket vars are unset', async () => {
      const module = await buildService(connectionOnly);

      expect(resolvedBuckets(module)).toEqual([
        'tracks',
        'album-art',
        'artist-image',
        'upload-staging',
      ]);
    });

    it('honors explicit bucket overrides', async () => {
      const module = await buildService({
        ...connectionOnly,
        STORAGE_TRACKS_BUCKET: 'custom-tracks',
        STORAGE_STAGING_BUCKET: 'custom-staging',
      });

      expect(resolvedBuckets(module)).toEqual([
        'custom-tracks',
        'album-art',
        'artist-image',
        'custom-staging',
      ]);
    });

    it('still throws when a connection variable is missing', async () => {
      await expect(
        buildService({ ...connectionOnly, STORAGE_ENDPOINT: undefined }),
      ).rejects.toThrow('Storage configuration is incomplete');
    });
  });

  describe('ensureBuckets', () => {
    const createdBuckets = (): (string | undefined)[] =>
      send.mock.calls
        .map((call) => call[0])
        .filter(
          (c): c is CreateBucketCommand => c instanceof CreateBucketCommand,
        )
        .map((c) => c.input.Bucket);

    it('creates every configured bucket that does not exist', async () => {
      send.mockImplementation((command) =>
        command instanceof HeadBucketCommand
          ? Promise.reject(makeS3Error('NotFound', 404))
          : Promise.resolve({}),
      );

      await storageService.ensureBuckets();

      expect(createdBuckets()).toEqual([
        'tracks',
        'album-art',
        'artist-image',
        'upload-staging',
      ]);
    });

    it('skips buckets that already exist', async () => {
      send.mockResolvedValue({});

      await storageService.ensureBuckets();

      expect(createdBuckets()).toHaveLength(0);
    });

    it('ignores a lost create race (bucket already owned)', async () => {
      send.mockImplementation((command) =>
        command instanceof HeadBucketCommand
          ? Promise.reject(makeS3Error('NotFound', 404))
          : Promise.reject(makeS3Error('BucketAlreadyOwnedByYou', 409)),
      );

      await expect(storageService.ensureBuckets()).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors from the head check', async () => {
      send.mockImplementation((command) =>
        command instanceof HeadBucketCommand
          ? Promise.reject(makeS3Error('AccessDenied', 403))
          : Promise.resolve({}),
      );

      await expect(storageService.ensureBuckets()).rejects.toThrow(
        S3ServiceException,
      );
    });
  });

  describe('createMultipartUpload', () => {
    it('returns the UploadId from a CreateMultipartUploadCommand', async () => {
      send.mockResolvedValue({ UploadId: 'upload-1' });

      const uploadId = await storageService.createMultipartUpload(
        StorageBucket.Staging,
        'session-1/file-1',
        'audio/flac',
      );

      expect(uploadId).toBe('upload-1');
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(CreateMultipartUploadCommand);
      if (command instanceof CreateMultipartUploadCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Staging,
          Key: 'session-1/file-1',
          ContentType: 'audio/flac',
        });
      }
    });

    it('throws when the response has no UploadId', async () => {
      send.mockResolvedValue({});

      await expect(
        storageService.createMultipartUpload(
          StorageBucket.Staging,
          'session-1/file-1',
          'audio/flac',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('completeMultipartUpload', () => {
    it('sends parts sorted ascending by part number', async () => {
      send.mockResolvedValue({});

      await storageService.completeMultipartUpload(
        StorageBucket.Staging,
        'session-1/file-1',
        'upload-1',
        [
          { partNumber: 2, etag: '"etag-2"' },
          { partNumber: 1, etag: '"etag-1"' },
        ],
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(CompleteMultipartUploadCommand);
      if (command instanceof CompleteMultipartUploadCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Staging,
          Key: 'session-1/file-1',
          UploadId: 'upload-1',
          MultipartUpload: {
            Parts: [
              { PartNumber: 1, ETag: '"etag-1"' },
              { PartNumber: 2, ETag: '"etag-2"' },
            ],
          },
        });
      }
    });
  });

  describe('abortMultipartUpload', () => {
    it('sends an AbortMultipartUploadCommand', async () => {
      send.mockResolvedValue({});

      await storageService.abortMultipartUpload(
        StorageBucket.Staging,
        'session-1/file-1',
        'upload-1',
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(AbortMultipartUploadCommand);
      if (command instanceof AbortMultipartUploadCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Staging,
          Key: 'session-1/file-1',
          UploadId: 'upload-1',
        });
      }
    });
  });

  describe('presigned upload URLs', () => {
    it('signs a PUT URL against the presigned (client-reachable) endpoint', async () => {
      const url = await storageService.presignPutObject(
        StorageBucket.Staging,
        'session-1/file-1',
        'audio/flac',
      );

      expect(url.startsWith('https://public.example.com/')).toBe(true);
      expect(url).not.toContain('internal.example.com');
      expect(url).toContain('upload-staging/session-1/file-1');
      expect(send).not.toHaveBeenCalled();
    });

    it('signs an UploadPart URL carrying the part number and upload id', async () => {
      const url = await storageService.presignUploadPart(
        StorageBucket.Staging,
        'session-1/file-1',
        'upload-1',
        3,
      );

      expect(url.startsWith('https://public.example.com/')).toBe(true);
      expect(url).toContain('partNumber=3');
      expect(url).toContain('uploadId=upload-1');
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('headObject', () => {
    it('returns the content length and type', async () => {
      send.mockResolvedValue({ ContentLength: 123, ContentType: 'audio/flac' });

      const result = await storageService.headObject(
        StorageBucket.Staging,
        'session-1/file-1',
      );

      expect(result).toEqual({ contentLength: 123, contentType: 'audio/flac' });
      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    });

    it('maps a not-found error to NotFoundException', async () => {
      send.mockRejectedValue(makeS3Error('NotFound', 404));

      await expect(
        storageService.headObject(StorageBucket.Staging, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when the response omits ContentLength', async () => {
      send.mockResolvedValue({ ContentType: 'audio/flac' });

      await expect(
        storageService.headObject(StorageBucket.Staging, 'session-1/file-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('copyObject', () => {
    it('copies with an encoded CopySource and preserves metadata by default', async () => {
      send.mockResolvedValue({});

      await storageService.copyObject(
        StorageBucket.Staging,
        'session-1/file-1',
        StorageBucket.Tracks,
        'album-1/1-01.flac',
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(CopyObjectCommand);
      if (command instanceof CopyObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: StorageBucket.Tracks,
          Key: 'album-1/1-01.flac',
          CopySource: 'upload-staging/session-1/file-1',
        });
        expect(command.input.MetadataDirective).toBeUndefined();
      }
    });

    it('replaces the content type when one is provided', async () => {
      send.mockResolvedValue({});

      await storageService.copyObject(
        StorageBucket.Staging,
        'session-1/file-1',
        StorageBucket.Tracks,
        'album-1/1-01.flac',
        'audio/flac',
      );

      const command = send.mock.calls[0][0];
      if (command instanceof CopyObjectCommand) {
        expect(command.input).toMatchObject({
          ContentType: 'audio/flac',
          MetadataDirective: 'REPLACE',
        });
      }
    });
  });

  describe('deletePrefix', () => {
    it('deletes every listed object under the prefix', async () => {
      send.mockImplementation((command) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve({
            Contents: [{ Key: 'session-1/a' }, { Key: 'session-1/b' }],
            IsTruncated: false,
          });
        }
        return Promise.resolve({});
      });

      await storageService.deletePrefix(StorageBucket.Staging, 'session-1/');

      const deletedKeys = send.mock.calls
        .map((call) => call[0])
        .filter(
          (c): c is DeleteObjectCommand => c instanceof DeleteObjectCommand,
        )
        .map((c) => c.input.Key);
      expect(deletedKeys).toEqual(['session-1/a', 'session-1/b']);
    });

    it('follows pagination via the continuation token', async () => {
      const pages: unknown[] = [
        {
          Contents: [{ Key: 'session-1/a' }],
          IsTruncated: true,
          NextContinuationToken: 'token-2',
        },
        { Contents: [{ Key: 'session-1/b' }], IsTruncated: false },
      ];
      let listCall = 0;
      send.mockImplementation((command) => {
        if (command instanceof ListObjectsV2Command) {
          return Promise.resolve(pages[listCall++]);
        }
        return Promise.resolve({});
      });

      await storageService.deletePrefix(StorageBucket.Staging, 'session-1/');

      const listCommands = send.mock.calls
        .map((call) => call[0])
        .filter(
          (c): c is ListObjectsV2Command => c instanceof ListObjectsV2Command,
        );
      expect(listCommands).toHaveLength(2);
      expect(listCommands[1].input.ContinuationToken).toBe('token-2');
    });

    it('does not throw when the listing fails', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      send.mockRejectedValue(new Error('storage down'));

      await expect(
        storageService.deletePrefix(StorageBucket.Staging, 'session-1/'),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });
});
