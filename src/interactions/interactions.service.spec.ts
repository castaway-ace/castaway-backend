import { Test, TestingModule } from '@nestjs/testing';
import { InteractionsService } from './interactions.service.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';

const moduleMocker = new ModuleMocker(global);

describe('InteractionsService', () => {
  let interactionsService: InteractionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InteractionsService],
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

    interactionsService = module.get<InteractionsService>(InteractionsService);
  });

  it('should be defined', () => {
    expect(interactionsService).toBeDefined();
  });
});
