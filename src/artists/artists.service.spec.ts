import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { ArtistsService } from './artists.service.js';

const moduleMocker = new ModuleMocker(global);

describe('ArtistService', () => {
  let artistService: ArtistsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArtistsService],
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

    artistService = module.get(ArtistsService);
  });

  it('should be defined', () => {
    expect(artistService).toBeDefined();
  });
});
