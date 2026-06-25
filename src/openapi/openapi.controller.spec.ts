import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import { OpenApiController } from './openapi.controller.js';
import { OpenApiService } from './openapi.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

describe('OpenApiController', () => {
  let openApiController: OpenApiController;

  const mockOpenApiService = {
    getDocument: jest.fn<OpenApiService['getDocument']>(),
  };

  const mockDocument = {
    openapi: '3.0.0',
    info: { title: 'Castaway API', version: '1.0.0' },
    paths: {},
  } satisfies OpenAPIObject;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenApiController],
      providers: [
        {
          provide: OpenApiService,
          useValue: mockOpenApiService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (): boolean => {
          return true;
        },
      })
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate: (): boolean => {
          return true;
        },
      })
      .compile();
    openApiController = module.get(OpenApiController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDocument', () => {
    it('returns the document produced by the service', () => {
      mockOpenApiService.getDocument.mockReturnValue(mockDocument);

      const result = openApiController.getDocument();

      expect(result).toBe(mockDocument);
      expect(mockOpenApiService.getDocument).toHaveBeenCalledTimes(1);
      expect(mockOpenApiService.getDocument).toHaveBeenCalledWith();
    });
  });
});
