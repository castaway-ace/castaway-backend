import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { SearchController } from './search.controller.js';
import { SearchResults, SearchService } from './search.service.js';

const moduleMocker = new ModuleMocker(global);

describe('SearchController', () => {
  let searchController: SearchController;

  const mockPlaylistsService = {
    find: jest.fn<SearchService['find']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockPlaylistsService,
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

    searchController = module.get(SearchController);
  });

  describe('find', () => {
    it('returns the results from the service', async () => {
      const mockSearchResults: SearchResults = {
        artists: [],
        albums: [],
        tracks: [],
      };
      mockPlaylistsService.find.mockResolvedValue(mockSearchResults);
      await expect(searchController.find('sub', { query: '12' })).resolves.toBe(
        mockSearchResults,
      );
      expect(mockPlaylistsService.find).toHaveBeenCalledWith('sub', '12');
    });
  });
});
