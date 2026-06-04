import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { RefreshTokenService } from './refresh-token.service.js';
import { ConfigService } from '@nestjs/config';

const moduleMocker = new ModuleMocker(global);

const configValues: Readonly<Record<string, unknown>> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRATION: '1h',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRATION: '7d',
};

describe('RefreshTokenService', () => {
  let refreshTokenService: RefreshTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RefreshTokenService],
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

    refreshTokenService = module.get(RefreshTokenService);
  });

  it('should be defined', () => {
    expect(refreshTokenService).toBeDefined();
  });
});
