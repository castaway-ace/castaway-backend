import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
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

  describe('getPublicUrl', () => {
    it('builds an unsigned, path-style URL against the public base host', () => {
      const url = storageService.getPublicUrl(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );

      expect(url).toBe(
        'https://public.example.com/album-art/album-1/cover.jpg',
      );
      expect(send).not.toHaveBeenCalled();
    });

    it('appends a ?v= cache-buster from the version timestamp', () => {
      const version = new Date('2026-01-02T03:04:05.000Z');

      const url = storageService.getPublicUrl(
        StorageBucket.ArtistArt,
        'artist-1/cover.jpg',
        version,
      );

      expect(url).toBe(
        `https://public.example.com/artist-image/artist-1/cover.jpg?v=${version.getTime()}`,
      );
    });

    it('percent-encodes each key segment but keeps the slash separators', () => {
      const url = storageService.getPublicUrl(
        StorageBucket.AlbumArt,
        'a b/c+d.jpg',
      );

      expect(url).toBe('https://public.example.com/album-art/a%20b/c%2Bd.jpg');
    });

    it('throws NotFoundException for a null key', () => {
      expect(() =>
        storageService.getPublicUrl(StorageBucket.AlbumArt, null),
      ).toThrow(NotFoundException);
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

    it('forwards cacheControl as the CacheControl header when provided', async () => {
      send.mockResolvedValue({});

      await storageService.putObject(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
        Buffer.from('img'),
        {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      );

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      if (command instanceof PutObjectCommand) {
        expect(command.input.CacheControl).toBe(
          'public, max-age=31536000, immutable',
        );
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

    const resolvedBuckets = (module: TestingModule): string[] => {
      const { privateBuckets, publicBuckets } =
        module.get(StorageService)['storageConfig'];
      return [...privateBuckets, ...publicBuckets];
    };

    it('falls back to the StorageBucket enum names when bucket vars are unset', async () => {
      const module = await buildService(connectionOnly);

      expect(resolvedBuckets(module)).toEqual([
        'tracks',
        'album-art',
        'artist-image',
      ]);
    });

    it('honors explicit bucket overrides', async () => {
      const module = await buildService({
        ...connectionOnly,
        STORAGE_TRACKS_BUCKET: 'custom-tracks',
      });

      expect(resolvedBuckets(module)).toEqual([
        'custom-tracks',
        'album-art',
        'artist-image',
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

      expect(createdBuckets()).toEqual(['tracks', 'album-art', 'artist-image']);
    });

    it('skips buckets that already exist', async () => {
      send.mockResolvedValue({});

      await storageService.ensureBuckets();

      expect(createdBuckets()).toHaveLength(0);
    });

    it('ignores a lost create race (bucket already owned)', async () => {
      send.mockImplementation((command) => {
        if (command instanceof HeadBucketCommand) {
          return Promise.reject(makeS3Error('NotFound', 404));
        }
        if (command instanceof CreateBucketCommand) {
          return Promise.reject(makeS3Error('BucketAlreadyOwnedByYou', 409));
        }
        return Promise.resolve({});
      });

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

    it('applies an anonymous read policy to the image buckets only', async () => {
      send.mockResolvedValue({});

      await storageService.ensureBuckets();

      const policyCommands = send.mock.calls
        .map((call) => call[0])
        .filter(
          (c): c is PutBucketPolicyCommand =>
            c instanceof PutBucketPolicyCommand,
        );

      expect(policyCommands.map((c) => c.input.Bucket)).toEqual([
        'album-art',
        'artist-image',
      ]);

      const policy = JSON.parse(policyCommands[0].input.Policy ?? '{}') as {
        Statement: Record<string, unknown>[];
      };
      expect(policy.Statement[0]).toMatchObject({
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: ['arn:aws:s3:::album-art/*'],
      });
    });
  });
});
