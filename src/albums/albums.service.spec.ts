import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AlbumsService } from './albums.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlbumEntity, AlbumSummaryEntity } from './albums.entity.js';
import { StorageService } from '../storage/storage.service.js';
import { AlbumRow, AlbumSummaryRow } from './albums.types.js';
import { StorageBucket } from '../storage/storage.types.js';
import { Prisma, Album as PrismaAlbum } from '../generated/prisma/client.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { IPicture } from 'music-metadata';

type AlbumAnnotations = { albumAnnotations: { albumId: string }[] };

type AlbumFindUniqueRow =
  (AlbumRow & AlbumAnnotations) | { imageKey: string | null } | null;

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
        jest.fn<() => Promise<(AlbumSummaryRow & AlbumAnnotations)[]>>(),
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
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '7.0.0',
      },
    );

    it('creates the album with its artist joins', async () => {
      mockPrismaService.album.create.mockResolvedValue(albumRow);

      const result = await albumService.create(
        'test1',
        ['artist-1'],
        releaseDate,
      );

      expect(result).toEqual(albumRow);
      expect(mockPrismaService.album.create).toHaveBeenCalledTimes(1);

      const createArgs = mockPrismaService.album.create.mock.calls[0][0];

      expect(createArgs).toMatchObject({
        data: {
          title: 'test1',
          releaseDate,
          albumArtists: { create: [{ artistId: 'artist-1' }] },
        },
      });
    });

    it('throws ConflictException when the identity key already exists', async () => {
      mockPrismaService.album.create.mockRejectedValue(p2002);

      await expect(
        albumService.create('test1', ['artist-1'], releaseDate),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes the cover object and then the album row', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      mockStorageService.deleteObject.mockResolvedValue(undefined);
      mockPrismaService.album.delete.mockResolvedValue(albumRow);

      await albumService.delete('album-1');

      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );
      expect(mockPrismaService.album.delete).toHaveBeenCalledWith({
        where: { id: 'album-1' },
      });
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

    it('still deletes the row when cover deletion fails', async () => {
      mockPrismaService.album.findUnique.mockResolvedValue({
        imageKey: 'album-1/cover.jpg',
      });
      mockStorageService.deleteObject.mockRejectedValue(
        new Error('storage unavailable'),
      );
      mockPrismaService.album.delete.mockResolvedValue(albumRow);

      await albumService.delete('album-1');

      expect(mockPrismaService.album.delete).toHaveBeenCalledWith({
        where: { id: 'album-1' },
      });
    });
  });

  describe('createAlbumCover', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    });

    const picture: IPicture = {
      format: 'image/jpeg',
      data: new Uint8Array([1, 2, 3]),
    };

    it('uploads the cover and then sets the image key', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);
      mockPrismaService.album.update.mockResolvedValue(albumRow);

      await albumService.createAlbumCover('album-1', picture);

      expect(mockStorageService.putObject).toHaveBeenCalledTimes(1);
      const putArgs = mockStorageService.putObject.mock.calls[0];
      expect(putArgs[0]).toBe(StorageBucket.AlbumArt);
      expect(putArgs[1]).toBe('album-1/cover.jpg');
      expect(putArgs[3]).toMatchObject({ contentType: 'image/jpeg' });

      expect(mockPrismaService.album.update).toHaveBeenCalledTimes(1);
      const updateArgs = mockPrismaService.album.update.mock.calls[0][0];
      expect(updateArgs).toMatchObject({
        where: { id: 'album-1' },
        data: { imageKey: 'album-1/cover.jpg' },
      });

      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });

    it('deletes the uploaded object and throws NotFoundException when the album does not exist', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);
      mockPrismaService.album.update.mockRejectedValue(p2025);
      mockStorageService.deleteObject.mockResolvedValue(undefined);

      await expect(
        albumService.createAlbumCover('album-1', picture),
      ).rejects.toThrow(NotFoundException);

      expect(mockStorageService.deleteObject).toHaveBeenCalledWith(
        StorageBucket.AlbumArt,
        'album-1/cover.jpg',
      );
    });

    it('deletes the uploaded object and rethrows unknown errors unchanged', async () => {
      const dbError = new Error('connection lost');
      mockStorageService.putObject.mockResolvedValue(undefined);
      mockPrismaService.album.update.mockRejectedValue(dbError);
      mockStorageService.deleteObject.mockResolvedValue(undefined);

      await expect(
        albumService.createAlbumCover('album-1', picture),
      ).rejects.toThrow(dbError);

      expect(mockStorageService.deleteObject).toHaveBeenCalled();
    });

    it('surfaces the original database error even when the cleanup delete fails', async () => {
      mockStorageService.putObject.mockResolvedValue(undefined);
      mockPrismaService.album.update.mockRejectedValue(p2025);
      mockStorageService.deleteObject.mockRejectedValue(
        new Error('storage unavailable'),
      );

      await expect(
        albumService.createAlbumCover('album-1', picture),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates an upload failure without touching the database or attempting cleanup', async () => {
      const uploadError = new Error('upload failed');
      mockStorageService.putObject.mockRejectedValue(uploadError);

      await expect(
        albumService.createAlbumCover('album-1', picture),
      ).rejects.toThrow(uploadError);

      expect(mockPrismaService.album.update).not.toHaveBeenCalled();
      expect(mockStorageService.deleteObject).not.toHaveBeenCalled();
    });
  });
});
