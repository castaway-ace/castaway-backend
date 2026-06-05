import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

const moduleMocker = new ModuleMocker(global);

describe('AuthController', () => {
  let adminController: AdminController;

  const mockAdminService = {
    uploadAlbum: jest.fn<AdminService['uploadAlbum']>(),
    uploadArtistArt: jest.fn<AdminService['uploadArtistArt']>(),
  };

  const mockFile = {
    originalname: 'cover.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake image'),
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
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
    adminController = module.get(AdminController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAlbum', () => {
    it('passes the files array to the service', async () => {
      const files = [mockFile, mockFile];
      mockAdminService.uploadAlbum.mockResolvedValue(undefined);

      await adminController.uploadAlbum(files);

      expect(mockAdminService.uploadAlbum).toHaveBeenCalledWith(files);
    });
  });

  describe('uploadArtistArt', () => {
    it('passes the id and file to the service', async () => {
      mockAdminService.uploadArtistArt.mockResolvedValue(undefined);

      await adminController.uploadArtistArt(mockFile, 'artist-id');

      expect(mockAdminService.uploadArtistArt).toHaveBeenCalledWith(
        'artist-id',
        mockFile,
      );
    });
  });
});
