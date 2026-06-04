import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AppService } from './app.service.js';

const moduleMocker = new ModuleMocker(global);

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
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

    appService = module.get(AppService);
  });

  it('should be defined', () => {
    expect(appService).toBeDefined();
  });
});
