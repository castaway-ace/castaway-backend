import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { OpenApiService } from './openapi.service.js';

const moduleMocker = new ModuleMocker(global);

describe('OpenapiService', () => {
  let openApiService: OpenApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiService],
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

    openApiService = module.get(OpenApiService);
  });

  it('should be defined', () => {
    expect(openApiService).toBeDefined();
  });
});
