import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { Artist, ArtistSummary } from '../types/artists.js';
import { ObjectStreamResult } from '../storage/storage.service.js';
import { Readable } from 'node:stream';
import { StreamableFile } from '@nestjs/common';

const moduleMocker = new ModuleMocker(global);

describe('ArtistsController', () => {
  let artistsController: ArtistsController;

  const mockArtistsService = {
    find: jest.fn<ArtistsService['find']>(),
    findAll: jest.fn<ArtistsService['findAll']>(),
    findArtistImage: jest.fn<ArtistsService['findArtistImage']>(),
    updateStar: jest.fn<ArtistsService['updateStar']>(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        {
          provide: ArtistsService,
          useValue: mockArtistsService,
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

    artistsController = moduleRef.get(ArtistsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('find', () => {
    it('should return an artist', async () => {
      const result: Artist = {
        id: 'artist-1',
        name: 'Test Artist',
        bio: '',
      };
      mockArtistsService.find.mockResolvedValue(result);

      await expect(artistsController.find('artist-1')).resolves.toBe(result);
    });
  });

  describe('findAll', () => {
    it('should return an array of artists', async () => {
      const result: ArtistSummary[] = [
        {
          id: 'artist-1',
          name: 'Test Artist',
        },
      ];
      mockArtistsService.findAll.mockResolvedValue(result);

      await expect(artistsController.findAll('sub', {})).resolves.toBe(result);
    });
  });

  describe('findArtistImage', () => {
    it('should return the image of an artist', async () => {
      const object: ObjectStreamResult = {
        stream: Readable.from(Buffer.from('image file')),
        contentType: 'image/jpeg',
        contentLength: 10,
      };
      mockArtistsService.findArtistImage.mockResolvedValue(object);

      const result = await artistsController.findArtistImage('artist-1');

      expect(result).toBeInstanceOf(StreamableFile);
      expect(result.getStream()).toBe(object.stream);
    });
  });

  describe('star', () => {
    it('calls updateStar with true', async () => {
      mockArtistsService.updateStar.mockResolvedValue(undefined);

      await artistsController.star('artist-1', 'sub');

      expect(mockArtistsService.updateStar).toHaveBeenCalledWith(
        'artist-1',
        'sub',
        true,
      );
    });
  });

  describe('unStar', () => {
    it('calls updateStar with false', async () => {
      mockArtistsService.updateStar.mockResolvedValue(undefined);

      await artistsController.unStar('artist-1', 'sub');

      expect(mockArtistsService.updateStar).toHaveBeenCalledWith(
        'artist-1',
        'sub',
        false,
      );
    });
  });
});
