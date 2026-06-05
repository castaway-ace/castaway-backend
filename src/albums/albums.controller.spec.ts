import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { Album, AlbumSummary } from '../types/albums.js';
import { ObjectStreamResult } from '../storage/storage.service.js';
import { Readable } from 'node:stream';

const moduleMocker = new ModuleMocker(global);

describe('AlbumsController', () => {
  let albumsController: AlbumsController;

  const mockAlbumsService = {
    find: jest.fn<AlbumsService['find']>(),
    findAll: jest.fn<AlbumsService['findAll']>(),
    findAlbumCover: jest.fn<AlbumsService['findAlbumCover']>(),
    updateStar: jest.fn<AlbumsService['updateStar']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [
        {
          provide: AlbumsService,
          useValue: mockAlbumsService,
        },
      ],
    })
      .useMocker((token) => {
        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(token) as MockMetadata<
            any,
            any
          >;
          const Mock = moduleMocker.generateFromMetadata(
            mockMetadata,
          ) as ObjectConstructor;
          return new Mock();
        }
      })
      .compile();

    albumsController = module.get(AlbumsController);
  });

  it('find', async () => {
    const mockAlbum: Album = {
      id: '1',
      title: 'test1',
      releaseDate: new Date(),
      artists: ['test1'],
      genres: ['test1'],
      compilation: false,
    };
    mockAlbumsService.find.mockResolvedValue(mockAlbum);
    await expect(albumsController.find('album-1')).resolves.toBe(mockAlbum);
  });

  it('findAll', async () => {
    const mockAlbumSummaries: AlbumSummary[] = [
      {
        id: '1',
        title: 'test1',
        releaseDate: new Date(),
        artists: ['test1'],
        genres: ['test1'],
      },
    ];
    mockAlbumsService.findAll.mockResolvedValue(mockAlbumSummaries);
    await expect(albumsController.findAll('sub', {})).resolves.toBe(
      mockAlbumSummaries,
    );
  });

  describe('findAlbumCover', () => {
    it('should return the image of an album cover', async () => {
      const object: ObjectStreamResult = {
        stream: Readable.from(Buffer.from('image file')),
        contentType: 'image/jpeg',
        contentLength: 10,
      };
      mockAlbumsService.findAlbumCover.mockResolvedValue(object);

      const result = await albumsController.findAlbumCover('album-1');

      expect(result).toBeInstanceOf(StreamableFile);
      expect(result.getStream()).toBe(object.stream);
    });
  });

  describe('star', () => {
    it('calls updateStar with true', async () => {
      mockAlbumsService.updateStar.mockResolvedValue(undefined);

      await albumsController.star('sub', 'album-1');

      expect(mockAlbumsService.updateStar).toHaveBeenCalledWith(
        'sub',
        'album-1',
        true,
      );
    });
  });

  describe('unStar', () => {
    it('calls updateStar with false', async () => {
      mockAlbumsService.updateStar.mockResolvedValue(undefined);

      await albumsController.unStar('sub', 'album-1');

      expect(mockAlbumsService.updateStar).toHaveBeenCalledWith(
        'sub',
        'album-1',
        false,
      );
    });
  });
});
