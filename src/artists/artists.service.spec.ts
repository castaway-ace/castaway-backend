import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ArtistsService } from './artists.service.js';
import { Prisma, Artist as PrismaArtist } from '../generated/prisma/client.js';
import { ArtistRow, ArtistSummaryRow } from './artists.types.js';
import { StorageService } from '../storage/storage.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ArtistEntity, ArtistSummaryEntity } from './artists.entity.js';
import { StorageBucket } from '../storage/storage.types.js';
import { NotFoundException } from '@nestjs/common';
import { ArtistRef } from '../common/entities/references.entity.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

type ArtistAnnotations = { artistAnnotations: { artistId: string }[] };

type ArtistFindUniqueRow =
  (ArtistRow & ArtistAnnotations) | { imageKey: string | null } | null;

const userId = 'user-1';

const artistRow: PrismaArtist = {
  id: 'artist-1',
  name: 'test1',
  bio: null,
  imageKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ArtistService', () => {
  let artistsService: ArtistsService;

  const mockPrismaService = {
    artist: {
      findUnique: jest.fn<() => Promise<ArtistFindUniqueRow>>(),
      findMany:
        jest.fn<() => Promise<(ArtistSummaryRow & ArtistAnnotations)[]>>(),
      create: jest.fn<(args: Prisma.ArtistCreateArgs) => Promise<ArtistRef>>(),
      delete: jest.fn<() => Promise<PrismaArtist>>(),
      update:
        jest.fn<(args: Prisma.ArtistUpdateArgs) => Promise<PrismaArtist>>(),
    },
    artistAnnotation: {
      upsert: jest.fn<() => Promise<unknown>>(),
      deleteMany: jest.fn<() => Promise<{ count: number }>>(),
    },
  };

  const mockStorageService = {
    getPresignedUrl: jest.fn<StorageService['getPresignedUrl']>(),
    putObject: jest.fn<StorageService['putObject']>(),
    deleteObjectQuietly: jest.fn<StorageService['deleteObjectQuietly']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtistsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    artistsService = module.get(ArtistsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    const artistSummaryRows: (ArtistSummaryRow & ArtistAnnotations)[] = [
      {
        id: 'artist-1',
        name: 'test1',
        artistAnnotations: [],
      },
    ];

    const artistSummaryEntities: ArtistSummaryEntity[] = [
      {
        id: 'artist-1',
        name: 'test1',
        starred: false,
      },
    ];
    it('should find all artists', async () => {
      mockPrismaService.artist.findMany.mockResolvedValue(artistSummaryRows);
      const result = await artistsService.findAll(userId, {});
      expect(result).toEqual(artistSummaryEntities);
    });
  });

  describe('find', () => {
    const artistRow: ArtistRow & ArtistAnnotations = {
      id: 'artist-1',
      name: 'test1',
      bio: null,
      albumArtists: [],
      artistAnnotations: [],
    };

    const artistEntity: ArtistEntity = {
      id: 'artist-1',
      name: 'test1',
      bio: null,
      albums: [],
      starred: false,
    };

    it('should find an artist by id', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue(artistRow);
      const result = await artistsService.find(userId, 'artist-1');
      expect(result).toEqual(artistEntity);
    });
  });

  describe('getArtistImageUrl', () => {
    const artistImageUrl = 'https://example.com/image.jpg';

    it('should get the artist image url', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({
        imageKey: 'artist-1/cover.jpg',
      });
      mockStorageService.getPresignedUrl.mockResolvedValue(artistImageUrl);
      const result = await artistsService.getArtistImageUrl('artist-1');
      expect(result).toEqual(artistImageUrl);
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        StorageBucket.ArtistArt,
        'artist-1/cover.jpg',
      );
    });

    it('throws NotFoundException when the artist has no image', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({
        imageKey: null,
      });

      await expect(
        artistsService.getArtistImageUrl('artist-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('star', () => {
    it('upserts the annotation when starring', async () => {
      mockPrismaService.artistAnnotation.upsert.mockResolvedValue({});

      await artistsService.star(userId, 'artist-1');

      expect(mockPrismaService.artistAnnotation.upsert).toHaveBeenCalledWith({
        where: { userId_artistId: { userId, artistId: 'artist-1' } },
        create: { userId, artistId: 'artist-1', starred: true },
        update: { starred: true },
      });
    });
  });

  describe('unstar', () => {
    it('deletes the annotation row when unstarring', async () => {
      mockPrismaService.artistAnnotation.deleteMany.mockResolvedValue({
        count: 1,
      });

      await artistsService.unstar(userId, 'artist-1');

      expect(
        mockPrismaService.artistAnnotation.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId, artistId: 'artist-1' },
      });
    });
  });

  describe('create', () => {
    const artistRef: ArtistRef = { id: 'artist-1', name: 'test1' };

    it('creates the artist', async () => {
      mockPrismaService.artist.create.mockResolvedValue(artistRef);

      const result = await artistsService.create({ ...artistRef });

      expect(result).toEqual(artistRef);
      expect(mockPrismaService.artist.create).toHaveBeenCalledTimes(1);

      const createArgs = mockPrismaService.artist.create.mock.calls[0][0];

      expect(createArgs).toMatchObject({
        data: {
          name: 'test1',
        },
      });
    });
  });

  describe('delete', () => {
    it('deletes the row before deleting the image object', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({
        imageKey: 'artist-1/cover.jpg',
      });
      mockPrismaService.artist.delete.mockResolvedValue(artistRow);
      mockStorageService.deleteObjectQuietly.mockResolvedValue(undefined);

      await artistsService.delete('artist-1');

      expect(mockPrismaService.artist.delete).toHaveBeenCalledWith({
        where: { id: 'artist-1' },
      });
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.ArtistArt,
        'artist-1/cover.jpg',
        expect.any(String),
      );

      const rowDeleteOrder =
        mockPrismaService.artist.delete.mock.invocationCallOrder[0];
      const objectDeleteOrder =
        mockStorageService.deleteObjectQuietly.mock.invocationCallOrder[0];
      expect(rowDeleteOrder).toBeLessThan(objectDeleteOrder);
    });

    it('skips storage deletion when the artist has no image', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({ imageKey: null });
      mockPrismaService.artist.delete.mockResolvedValue(artistRow);

      await artistsService.delete('artist-1');

      expect(mockStorageService.deleteObjectQuietly).not.toHaveBeenCalled();
      expect(mockPrismaService.artist.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when the artist does not exist', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue(null);

      await expect(artistsService.delete('artist-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.artist.delete).not.toHaveBeenCalled();
    });

    it('does not touch storage when the row deletion fails', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({
        imageKey: 'artist-1/cover.jpg',
      });
      const dbError = new Error('db unavailable');
      mockPrismaService.artist.delete.mockRejectedValue(dbError);

      await expect(artistsService.delete('artist-1')).rejects.toThrow(dbError);
      expect(mockStorageService.deleteObjectQuietly).not.toHaveBeenCalled();
    });

    it('deletes the image via the best-effort (quiet) helper', async () => {
      mockPrismaService.artist.findUnique.mockResolvedValue({
        imageKey: 'artist-1/cover.jpg',
      });
      mockPrismaService.artist.delete.mockResolvedValue(artistRow);
      mockStorageService.deleteObjectQuietly.mockResolvedValue(undefined);

      await expect(artistsService.delete('artist-1')).resolves.toBeUndefined();

      // Cleanup goes through deleteObjectQuietly, which swallows storage
      // failures itself (covered in StorageService), so delete never rejects
      // on a storage error.
      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadImage', () => {
    let tmpDir: string;
    let uploadFile: Express.Multer.File;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'artists-spec-'));
      const filePath = join(tmpDir, 'cover.jpg');
      await writeFile(filePath, Buffer.from([1, 2, 3]));
      uploadFile = {
        originalname: 'cover.jpg',
        mimetype: 'image/jpeg',
        path: filePath,
        size: 3,
      } as Express.Multer.File;
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('uploads the image and then sets the image key', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);
      mockPrismaService.artist.update.mockResolvedValue(artistRow);

      await artistsService.uploadImage('artist-1', uploadFile);

      expect(mockStorageService.putObject).toHaveBeenCalledTimes(1);
      const putArgs = mockStorageService.putObject.mock.calls[0];
      expect(putArgs[0]).toBe(StorageBucket.ArtistArt);
      expect(putArgs[1]).toBe('artist-1/cover.jpg');
      expect(putArgs[3]).toMatchObject({ contentType: 'image/jpeg' });

      expect(mockPrismaService.artist.update).toHaveBeenCalledTimes(1);
      const updateArgs = mockPrismaService.artist.update.mock.calls[0][0];
      expect(updateArgs).toMatchObject({
        where: { id: 'artist-1' },
        data: { imageKey: 'artist-1/cover.jpg' },
      });

      expect(mockStorageService.deleteObjectQuietly).not.toHaveBeenCalled();
    });

    it('deletes the uploaded object when setting the image key fails', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);
      const updateError = new Error('record not found');
      mockPrismaService.artist.update.mockRejectedValue(updateError);
      mockStorageService.deleteObjectQuietly.mockResolvedValue(undefined);

      await expect(
        artistsService.uploadImage('artist-1', uploadFile),
      ).rejects.toThrow(updateError);

      expect(mockStorageService.deleteObjectQuietly).toHaveBeenCalledWith(
        StorageBucket.ArtistArt,
        'artist-1/cover.jpg',
        expect.any(String),
      );
    });
  });
});
