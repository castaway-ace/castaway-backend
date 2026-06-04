import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AlbumsService } from './albums.service.js';

const moduleMocker = new ModuleMocker(global);

describe('AlbumService', () => {
  let albumService: AlbumsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlbumsService],
    })
      .useMocker((token) => {
        const results = ['test1', 'test2'];
        if (token === AlbumsService) {
          return { findAll: jest.fn().mockResolvedValue(results) };
        }
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

    albumService = module.get(AlbumsService);
  });

  it('should be defined', () => {
    expect(albumService).toBeDefined();
  });
});
