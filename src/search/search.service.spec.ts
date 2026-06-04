import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { SearchService } from './search.service.js';

const moduleMocker = new ModuleMocker(global);

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService],
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

    searchService = module.get(SearchService);
  });

  it('should be defined', () => {
    expect(searchService).toBeDefined();
  });
});
