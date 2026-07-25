import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { Request } from 'express';
import { UploadSessionsController } from './upload-sessions.controller.js';
import { UploadSessionsService } from './upload-sessions.service.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { ImportSessionStatus } from '../generated/prisma/enums.js';
import {
  CreateUploadSessionResponse,
  UploadSessionFileStatus,
  UploadSessionStatusResponse,
} from './upload-sessions.entity.js';

const response: CreateUploadSessionResponse = {
  sessionId: 'session-1',
  partSize: 64,
  expiresAt: new Date('2026-07-23T00:00:00.000Z'),
  files: [
    { fileId: 'file-1', name: 'song.flac', mode: 'single', url: 'https://put' },
  ],
};

const statusResponse: UploadSessionStatusResponse = {
  sessionId: 'session-1',
  status: ImportSessionStatus.PENDING_UPLOAD,
  phase: null,
  progress: { current: 0, total: 1 },
  error: null,
  albumId: null,
  createdAt: new Date('2026-07-23T00:00:00.000Z'),
  finishedAt: null,
  files: [
    { fileId: 'file-1', name: 'song.flac', size: 1024, uploadedAt: null },
  ],
};

const fileStatus: UploadSessionFileStatus = {
  fileId: 'file-1',
  name: 'song.flac',
  size: 1024,
  uploadedAt: new Date('2026-07-23T01:00:00.000Z'),
};

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';

describe('UploadSessionsController', () => {
  let app: INestApplication<App>;

  const mockService = {
    createSession: jest
      .fn<UploadSessionsService['createSession']>()
      .mockResolvedValue(response),
    getStatus: jest
      .fn<UploadSessionsService['getStatus']>()
      .mockResolvedValue(statusResponse),
    completeFile: jest
      .fn<UploadSessionsService['completeFile']>()
      .mockResolvedValue(fileStatus),
    abortSession: jest
      .fn<UploadSessionsService['abortSession']>()
      .mockResolvedValue(undefined),
    finalizeSession: jest
      .fn<UploadSessionsService['finalizeSession']>()
      .mockResolvedValue(undefined),
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

  describe('GET /admin/upload-sessions/:id', () => {
    it('returns the session status', async () => {
      await request(app.getHttpServer())
        .get(`/admin/upload-sessions/${SESSION_ID}`)
        .expect(200);

      expect(mockService.getStatus).toHaveBeenCalledWith(SESSION_ID);
    });

    it('rejects a malformed id without reaching the service', async () => {
      await request(app.getHttpServer())
        .get('/admin/upload-sessions/not-a-uuid')
        .expect(400);

      expect(mockService.getStatus).not.toHaveBeenCalled();
    });

    it('maps a NotFoundException to 404', async () => {
      mockService.getStatus.mockRejectedValueOnce(new NotFoundException());

      await request(app.getHttpServer())
        .get(`/admin/upload-sessions/${SESSION_ID}`)
        .expect(404);
    });
  });

  describe('POST /admin/upload-sessions/:id/files/:fileId/complete', () => {
    const url = `/admin/upload-sessions/${SESSION_ID}/files/${FILE_ID}/complete`;

    it('completes a file and forwards the parts to the service', async () => {
      await request(app.getHttpServer())
        .post(url)
        .send({ parts: [{ partNumber: 1, etag: 'abc' }] })
        .expect(200);

      expect(mockService.completeFile).toHaveBeenCalledWith(
        SESSION_ID,
        FILE_ID,
        [{ partNumber: 1, etag: 'abc' }],
      );
    });

    it('defaults to an empty parts array for single-PUT files', async () => {
      await request(app.getHttpServer()).post(url).send({}).expect(200);

      expect(mockService.completeFile).toHaveBeenCalledWith(
        SESSION_ID,
        FILE_ID,
        [],
      );
    });

    it('rejects an invalid part number without reaching the service', async () => {
      await request(app.getHttpServer())
        .post(url)
        .send({ parts: [{ partNumber: 0, etag: 'abc' }] })
        .expect(400);

      expect(mockService.completeFile).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /admin/upload-sessions/:id', () => {
    it('aborts the session and returns 204', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/upload-sessions/${SESSION_ID}`)
        .expect(204);

      expect(mockService.abortSession).toHaveBeenCalledWith(SESSION_ID);
    });

    it('maps a ConflictException to 409', async () => {
      mockService.abortSession.mockRejectedValueOnce(new ConflictException());

      await request(app.getHttpServer())
        .delete(`/admin/upload-sessions/${SESSION_ID}`)
        .expect(409);
    });
  });

  describe('POST /admin/upload-sessions/:id/finalize', () => {
    it('finalizes the session and returns 202', async () => {
      await request(app.getHttpServer())
        .post(`/admin/upload-sessions/${SESSION_ID}/finalize`)
        .expect(202);

      expect(mockService.finalizeSession).toHaveBeenCalledWith(SESSION_ID);
    });

    it('rejects a malformed id without reaching the service', async () => {
      await request(app.getHttpServer())
        .post('/admin/upload-sessions/not-a-uuid/finalize')
        .expect(400);

      expect(mockService.finalizeSession).not.toHaveBeenCalled();
    });
  });
});
