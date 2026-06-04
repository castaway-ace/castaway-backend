import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { TracksService } from './tracks.service.js';

const moduleMocker = new ModuleMocker(global);

describe('TracksService', () => {
  let tracksService: TracksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TracksService],
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

    tracksService = module.get(TracksService);
  });

  it('should be defined', () => {
    expect(tracksService).toBeDefined();
  });
});
