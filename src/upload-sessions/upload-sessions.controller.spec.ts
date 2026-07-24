import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { Request } from 'express';
import { UploadSessionsController } from './upload-sessions.controller.js';
import { UploadSessionsService } from './upload-sessions.service.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { CreateUploadSessionResponse } from './upload-sessions.entity.js';

const response: CreateUploadSessionResponse = {
  sessionId: 'session-1',
  partSize: 64,
  expiresAt: new Date('2026-07-23T00:00:00.000Z'),
  files: [
    { fileId: 'file-1', name: 'song.flac', mode: 'single', url: 'https://put' },
  ],
};

describe('UploadSessionsController', () => {
  let app: INestApplication<App>;

  const mockService = {
    createSession: jest
      .fn<UploadSessionsService['createSession']>()
      .mockResolvedValue(response),
  };

  const validBody = {
    files: [{ name: 'song.flac', size: 1024, contentType: 'audio/flac' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadSessionsController],
      providers: [{ provide: UploadSessionsService, useValue: mockService }],
    })
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<Request>();
          req.user = { sub: 'admin-user', isAdmin: true, deviceId: '1' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a session and passes the files and admin id to the service', async () => {
    await request(app.getHttpServer())
      .post('/admin/upload-sessions')
      .send(validBody)
      .expect(201);

    expect(mockService.createSession).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: 'song.flac',
          size: 1024,
          contentType: 'audio/flac',
        }),
      ],
      'admin-user',
    );
  });

  it('rejects an empty files array', async () => {
    await request(app.getHttpServer())
      .post('/admin/upload-sessions')
      .send({ files: [] })
      .expect(400);

    expect(mockService.createSession).not.toHaveBeenCalled();
  });

  it('rejects an unsupported content type', async () => {
    await request(app.getHttpServer())
      .post('/admin/upload-sessions')
      .send({
        files: [{ name: 'x', size: 10, contentType: 'application/zip' }],
      })
      .expect(400);

    expect(mockService.createSession).not.toHaveBeenCalled();
  });

  it('rejects a non-positive size', async () => {
    await request(app.getHttpServer())
      .post('/admin/upload-sessions')
      .send({ files: [{ name: 'x', size: 0, contentType: 'audio/flac' }] })
      .expect(400);

    expect(mockService.createSession).not.toHaveBeenCalled();
  });

  it('rejects more than 200 files', async () => {
    const files = Array.from({ length: 201 }, (_, index) => ({
      name: `track-${index}.flac`,
      size: 10,
      contentType: 'audio/flac',
    }));

    await request(app.getHttpServer())
      .post('/admin/upload-sessions')
      .send({ files })
      .expect(400);

    expect(mockService.createSession).not.toHaveBeenCalled();
  });
});
