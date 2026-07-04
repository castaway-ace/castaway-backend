import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AlbumsService } from './albums.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlbumEntity, AlbumSummaryEntity } from './albums.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { AlbumCreateData, AlbumRow, AlbumSummaryRow } from './albums.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { Prisma, Album as PrismaAlbum } from '../generated/prisma/client.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { IPicture } from 'music-metadata';
import { buildAlbumIdentity } from '../common/album-identity.js';

type AlbumAnnotations = { albumAnnotations: { albumId: string }[] };

type AlbumFindUniqueRow =
  | (AlbumRow & AlbumAnnotations)
  | { imageKey: string | null }
  | { id: string }
  | null;

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const artistRef = { id: 'artist-1', name: 'Test Artist' };

const userId = 'user-1';

const albumRow: PrismaAlbum = {
  id: 'album-1',
  title: 'test1',
  releaseDate,
  compilation: false,
  imageKey: null,
  identityKey: 'identity-key-1',
  genres: [],
  createdAt: releaseDate,
  updatedAt: releaseDate,
};

describe('AlbumService', () => {
  let albumService: AlbumsService;

  const mockPrismaService = {
    album: {
      findUnique: jest.fn<() => Promise<AlbumFindUniqueRow>>(),
      findMany:
        jest.fn<
          (
            args: Prisma.AlbumFindManyArgs,
          ) => Promise<(AlbumSummaryRow & AlbumAnnotations)[]>
        >(),
      create: jest.fn<(args: Prisma.AlbumCreateArgs) => Promise<PrismaAlbum>>(),
      delete: jest.fn<() => Promise<PrismaAlbum>>(),
      update: jest.fn<(args: Prisma.AlbumUpdateArgs) => Promise<PrismaAlbum>>(),
    },
    albumAnnotation: {
      upsert: jest.fn<() => Promise<unknown>>(),
      deleteMany: jest.fn<() => Promise<{ count: number }>>(),
    },
  };

  const mockStorageService = {
    getPresignedUrl: jest.fn<StorageService['getPresignedUrl']>(),
    putObject: jest.fn<StorageService['putObject']>(),
    deleteObject: jest.fn<StorageService['deleteObject']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbumsService,
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

    albumService = module.get(AlbumsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    const albumSummaryRows: (AlbumSummaryRow & AlbumAnnotations)[] = [
      {
        id: 'album-1',
        title: 'test1',
        releaseDate,
        genres: ['rock'],
        albumArtists: [{ artist: artistRef }],
        albumAnnotations: [],
      },
    ];

    const albumSummaryEntities: AlbumSummaryEntity[] = [
      {
        id: 'album-1',
        title: 'test1',
        releaseDate,
        genres: ['rock'],
        artists: [artistRef],
        starred: false,
      },
    ];

    it('should find all albums', async () => {
      mockPrismaService.album.findMany.mockResolvedValue(albumSummaryRows);
      const result = await albumService.findAll(userId, {});
      expect(result).toEqual(albumSummaryEntities);
    });

    it('applies the default ordering, tiebreaker, and pagination clamp', async () => {
      mockPrismaService.album.findMany.mockResolvedValue([]);

      await albumService.findAll(userId, {});

      expect(mockPrismaService.album.findMany).toHaveBeenCalledTimes(1);
      const args = mockPrismaService.album.findMany.mock.calls[0][0];
      expect(args).toMatchObject({
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        take: 100,
        skip: 0,
        where: {},
      });
    });

    it('builds where, orderBy, and pagination from the supplied options', async () => {
      mockPrismaService.album.findMany.mockResolvedValue([]);

      await albumService.findAll(userId, {
        filters: {
          artistIds: ['artist-1'],
          genres: ['rock'],
          starred: true,
          search: 'foo',
        },
        sortOptions: { order: 'year', orderBy: 'desc' },
        pagination: { limit: 10, offset: 20 },
      });

      const args = mockPrismaService.album.findMany.mock.calls[0][0];
      expect(args).toMatchObject({
        orderBy: [{ releaseDate: 'desc' }, { id: 'asc' }],
        take: 10,
        skip: 20,
        where: {
          albumArtists: { some: { artistId: { in: ['artist-1'] } } },
          genres: { hasSome: ['rock'] },
          albumAnnotations: { some: { userId, starred: true } },
          OR: [
            { title: { contains: 'foo', mode: 'insensitive' } },
            {
              albumArtists: {
                some: {
                  artist: {
                    name: { contains: 'foo', mode: 'insensitive' },
                  },
                },
              },
            },
          ],
        },
      });
    });
  });

  describe('find', () => {
    const albumRow: AlbumRow & AlbumAnnotations = {
      id: 'album-1',
      title: 'test1',
      releaseDate,
      compilation: false,
      genres: ['rock'],
      albumArtists: [{ artist: artistRef }],
      tracks: [],
      albumAnnotations: [],
    };

    const albumEntity: AlbumEntity = {
      id: 'album-1',
      title: 'test1',
      releaseDate,
      compilation: false,
      genres: ['rock'],
      artists: [artistRef],
      starred: false,
      tracks: [],
    };

    it('should find an album by id', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue(albumRow);
      const result = await albumService.find(userId, 'album-1');
      expect(result).toEqual(albumEntity);
    });

    it('throws NotFoundException when the album does not exist', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue(null);

      await expect(albumService.find(userId, 'album-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAlbumCoverUrl', () => {
    const albumCoverUrl = 'https://example.com/cover.jpg';

    it('should get the album cover url', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      mockStorageService.getPresignedUrl.mockResolvedValue(albumCoverUrl);
      const result = await albumService.getAlbumCoverUrl('album-1');
      expect(result).toEqual(albumCoverUrl);
      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );
    });

    it('throws NotFoundException when the album has no cover', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({ imageKey: null });

      await expect(albumService.getAlbumCoverUrl('album-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the album does not exist', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue(null);

      await expect(albumService.getAlbumCoverUrl('album-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('star', () => {
    it('upsert the annotation when starring', async () => {
      mockPrismaService.albumAnnotation.upsert.mockResolvedValue({});

      await albumService.star(userId, 'album-1');

      expect(mockPrismaService.albumAnnotation.upsert).toHaveBeenCalledWith({
        where: { userId_albumId: { userId, albumId: 'album-1' } },
        create: { userId, albumId: 'album-1', starred: true },
        update: { starred: true },
      });
    });
  });

  describe('unstar', () => {
    it('deletes the annotation row when unstarring', async () => {
      mockPrismaService.albumAnnotation.deleteMany.mockResolvedValue({
        count: 1,
      });

      await albumService.unstar(userId, 'album-1');

      expect(mockPrismaService.albumAnnotation.deleteMany).toHaveBeenCalledWith(
        {
          where: { userId, albumId: 'album-1' },
        },
      );
    });
  });

  describe('create', () => {
    const createData: AlbumCreateData = {
      id: 'album-1',
      title: 'test1',
      releaseDate,
      identityKey: 'identity-key-1',
      imageKey: 'album-1/cover.jpg',
      artistIds: ['artist-1'],
    };

    it('creates the album with its artist joins and the supplied id and image key', async () => {
      mockPrismaService.album.create.mockResolvedValue(albumRow);

      await albumService.create(createData);

      expect(mockPrismaService.album.create).toHaveBeenCalledTimes(1);
      const createArgs = mockPrismaService.album.create.mock.calls[0][0];
      expect(createArgs).toMatchObject({
        data: {
          id: 'album-1',
          title: 'test1',
          releaseDate,
          identityKey: 'identity-key-1',
          imageKey: 'album-1/cover.jpg',
          albumArtists: { create: [{ artistId: 'artist-1' }] },
        },
      });
    });

    it('uses the transaction client when provided', async () => {
      const txCreate = jest
        .fn<(args: Prisma.AlbumCreateArgs) => Promise<PrismaAlbum>>()
        .mockResolvedValue(albumRow);
      const tx = {
        album: { create: txCreate },
      } as unknown as Prisma.TransactionClient;

      await albumService.create(createData, tx);

      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.album.create).not.toHaveBeenCalled();
    });

    it('propagates a P2002 unique constraint violation unmodified', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`identity_key`)',
        { code: 'P2002', clientVersion: 'test' },
      );
      mockPrismaService.album.create.mockRejectedValue(p2002);

      await expect(albumService.create(createData)).rejects.toBe(p2002);
    });
  });

  describe('assertNotImported', () => {
    it('returns the identity key when the album is not imported', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue(null);

      const result = await albumService.assertNotImported('test1', [
        'artist-1',
      ]);

      expect(result).toEqual(buildAlbumIdentity('test1', ['artist-1']));
      expect(mockPrismaService.album.findUnique).toHaveBeenCalledWith({
        where: { identityKey: result },
        select: { id: true },
      });
    });

    it('throws ConflictException when the album is already imported', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({ id: 'album-1' });

      await expect(
        albumService.assertNotImported('test1', ['artist-1']),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes the row before deleting the cover object', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      mockPrismaService.album.delete.mockResolvedValue(albumRow);
      mockStorageService.deleteObject.mockResolvedValue(undefined);

      await albumService.delete('album-1');

      expect(mockPrismaService.album.delete).toHaveBeenCalledWith({
        where: { id: 'album-1' },
      });
      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );

      const rowDeleteOrder =
        mockPrismaService.album.delete.mock.invocationCallOrder[0];
      const objectDeleteOrder =
        mockStorageService.deleteObject.mock.invocationCallOrder[0];
      expect(rowDeleteOrder).toBeLessThan(objectDeleteOrder);
    });

    it('skips storage deletion when the album has no cover', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({ imageKey: null });
      mockPrismaService.album.delete.mockResolvedValue(albumRow);

      await albumService.delete('album-1');

      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
      expect(mockPrismaService.album.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when the album does not exist', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue(null);

      await expect(albumService.delete('album-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.album.delete).not.toHaveBeenCalled();
    });

    it('does not touch storage when the row deletion fails', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      const dbError = new Error('db unavailable');
      mockPrismaService.album.delete.mockRejectedValue(dbError);

      await expect(albumService.delete('album-1')).rejects.toThrow(dbError);
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('completes even when the cover object deletion fails', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      mockPrismaService.album.delete.mockResolvedValue(albumRow);
      mockStorageService.deleteObject.mockRejectedValue(
        new Error('storage unavailable'),
      );

      await expect(albumService.delete('album-1')).resolves.toBeUndefined();

      expect(mockPrismaService.album.delete).toHaveBeenCalledWith({
        where: { id: 'album-1' },
      });
    });
  });

  describe('uploadCover', () => {
    const picture: IPicture = {
      format: 'image/jpeg',
      data: new Uint8Array([1, 2, 3]),
    };

    it('uploads the cover buffer to the album art bucket', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);

      await albumService.uploadCover('album-1/cover.jpg', picture);

      expect(mockStorageService.putObject).toHaveBeenCalledTimes(1);
      const putArgs = mockStorageService.putObject.mock.calls[0];
      expect(putArgs[0]).toBe(StorageBucket.AlbumArt);
      expect(putArgs[1]).toBe('album-1/cover.jpg');
      expect(putArgs[3]).toMatchObject({ contentType: 'image/jpeg', size: 3 });
    });
  });

  describe('deleteCoverObject', () => {
    it('deletes the cover object', async () => {
      mockStorageService.deleteObject.mockResolvedValue(undefined);

      await albumService.deleteCoverObject('album-1/cover.jpg');

      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );
    });

    it('swallows a storage failure without throwing', async () => {
      mockStorageService.deleteObject.mockRejectedValue(
        new Error('storage unavailable'),
      );

      await expect(
        albumService.deleteCoverObject('album-1/cover.jpg'),
      ).resolves.toBeUndefined();
    });
  });
});
