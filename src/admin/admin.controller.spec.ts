import { jest } from '@jest/globals';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { App } from 'supertest/types.js';
import type { Request } from 'express';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { Role } from '../generated/prisma/client.js';

const albumId = '11111111-1111-1111-1111-111111111111';
const artistId = '22222222-2222-2222-2222-222222222222';

const artistRef = { id: artistId, name: 'artist', isVarious: false };

// The roles the mock auth guard injects onto request.user for the next request.
let currentRoles: Role[] = [];

describe('AdminController', () => {
  let app: INestApplication<App>;

  const adminService = {
    uploadAlbum: jest.fn<AdminService['uploadAlbum']>(),
    uploadArtist: jest.fn<AdminService['uploadArtist']>(),
    uploadArtistImage: jest.fn<AdminService['uploadArtistImage']>(),
    deleteAlbum: jest.fn<AdminService['deleteAlbum']>(),
    deleteArtist: jest.fn<AdminService['deleteArtist']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    adminService.uploadAlbum.mockResolvedValue(undefined);
    adminService.uploadArtist.mockResolvedValue(artistRef);
    adminService.uploadArtistImage.mockResolvedValue(undefined);
    adminService.deleteAlbum.mockResolvedValue(undefined);
    adminService.deleteArtist.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminService },
        // Registered before PermissionsGuard so request.user is set first.
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<Request>();
              req.user = {
                sub: 'admin-user',
                deviceId: '1',
                roles: currentRoles,
              };
              return true;
            },
          },
        },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /admin/albums', () => {
    it('passes the uploaded files to the service for an admin', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post('/admin/albums')
        .attach('files', Buffer.from('track one'), '01.flac')
        .attach('files', Buffer.from('track two'), '02.flac')
        .expect(201);

      const files = adminService.uploadAlbum.mock.calls[0][0];
      expect(files.map((file) => file.originalname)).toEqual([
        '01.flac',
        '02.flac',
      ]);
    });

    it('forbids a caller without the catalog:write permission', async () => {
      currentRoles = [Role.USER];

      await request(app.getHttpServer())
        .post('/admin/albums')
        .attach('files', Buffer.from('track one'), '01.flac')
        .expect(403);

      expect(adminService.uploadAlbum).not.toHaveBeenCalled();
    });
  });

  describe('POST /admin/artists', () => {
    it('creates the artist and returns it for an admin', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post('/admin/artists')
        .field('name', 'artist')
        .expect(201)
        .expect(artistRef);

      expect(adminService.uploadArtist).toHaveBeenCalledWith(
        'artist',
        undefined,
      );
    });

    it('passes an attached image to the service', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post('/admin/artists')
        .field('name', 'artist')
        .attach('file', Buffer.from('fake image'), 'artist.jpg')
        .expect(201);

      expect(adminService.uploadArtist).toHaveBeenCalledWith(
        'artist',
        expect.objectContaining({ originalname: 'artist.jpg' }),
      );
    });

    it('rejects a request without a name', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post('/admin/artists')
        .field('unexpected', 'value')
        .expect(400);

      expect(adminService.uploadArtist).not.toHaveBeenCalled();
    });

    it('forbids a caller without the catalog:write permission', async () => {
      currentRoles = [Role.USER];

      await request(app.getHttpServer())
        .post('/admin/artists')
        .field('name', 'artist')
        .expect(403);

      expect(adminService.uploadArtist).not.toHaveBeenCalled();
    });
  });

  describe('POST /admin/artists/:id/image', () => {
    it('passes the uploaded image to the service for an admin', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post(`/admin/artists/${artistId}/image`)
        .attach('file', Buffer.from('fake image'), 'cover.jpg')
        .expect(204);

      expect(adminService.uploadArtistImage).toHaveBeenCalledWith(
        artistId,
        expect.objectContaining({ originalname: 'cover.jpg' }),
      );
    });

    it('forbids a caller without the catalog:write permission', async () => {
      currentRoles = [Role.USER];

      await request(app.getHttpServer())
        .post(`/admin/artists/${artistId}/image`)
        .attach('file', Buffer.from('fake image'), 'cover.jpg')
        .expect(403);

      expect(adminService.uploadArtistImage).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID before reaching the service', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .post('/admin/artists/not-a-uuid/image')
        .attach('file', Buffer.from('fake image'), 'cover.jpg')
        .expect(400);

      expect(adminService.uploadArtistImage).not.toHaveBeenCalled();
    });

    it('returns 404 when the artist does not exist', async () => {
      currentRoles = [Role.ADMIN];
      adminService.uploadArtistImage.mockRejectedValue(
        new NotFoundException('Artist not found'),
      );

      await request(app.getHttpServer())
        .post(`/admin/artists/${artistId}/image`)
        .attach('file', Buffer.from('fake image'), 'cover.jpg')
        .expect(404);
    });
  });

  describe('DELETE /admin/artists/:id', () => {
    it('deletes the artist and returns no content for an admin', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .delete(`/admin/artists/${artistId}`)
        .expect(204);

      expect(adminService.deleteArtist).toHaveBeenCalledWith(artistId);
    });

    it('forbids a caller without the catalog:delete permission', async () => {
      currentRoles = [Role.USER];

      await request(app.getHttpServer())
        .delete(`/admin/artists/${artistId}`)
        .expect(403);

      expect(adminService.deleteArtist).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID before reaching the service', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .delete('/admin/artists/not-a-uuid')
        .expect(400);

      expect(adminService.deleteArtist).not.toHaveBeenCalled();
    });

    it('returns 404 when the artist does not exist', async () => {
      currentRoles = [Role.ADMIN];
      adminService.deleteArtist.mockRejectedValue(
        new NotFoundException('Artist not found'),
      );

      await request(app.getHttpServer())
        .delete(`/admin/artists/${artistId}`)
        .expect(404);
    });
  });

  describe('DELETE /admin/albums/:id', () => {
    it('deletes the album and returns no content for an admin', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .delete(`/admin/albums/${albumId}`)
        .expect(204);

      expect(adminService.deleteAlbum).toHaveBeenCalledWith(albumId);
    });

    it('forbids a caller without the catalog:delete permission', async () => {
      currentRoles = [Role.USER];

      await request(app.getHttpServer())
        .delete(`/admin/albums/${albumId}`)
        .expect(403);

      expect(adminService.deleteAlbum).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID before reaching the service', async () => {
      currentRoles = [Role.ADMIN];

      await request(app.getHttpServer())
        .delete('/admin/albums/not-a-uuid')
        .expect(400);

      expect(adminService.deleteAlbum).not.toHaveBeenCalled();
    });

    it('returns 404 when the album does not exist', async () => {
      currentRoles = [Role.ADMIN];
      adminService.deleteAlbum.mockRejectedValue(
        new NotFoundException('Album not found'),
      );

      await request(app.getHttpServer())
        .delete(`/admin/albums/${albumId}`)
        .expect(404);
    });
  });
});
