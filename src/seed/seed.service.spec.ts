import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { SeedService } from './seed.service.js';
import { ConfigService } from '@nestjs/config';

const moduleMocker = new ModuleMocker(global);

const configValues: Readonly<Record<string, unknown>> = {
  STORAGE_ENDPOINT: 'https://storage.example.com',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'access-key',
  STORAGE_SECRET_ACCESS_KEY: 'secret-access-key',
};

describe('SeedService', () => {
  let seedService: SeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeedService],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          return {
            get: jest.fn((key: string): unknown => configValues[key]),
          };
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

    seedService = module.get(SeedService);
  });

  it('should be defined', () => {
    expect(seedService).toBeDefined();
  });
});
