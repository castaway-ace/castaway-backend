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
    uploadArtistImage: jest.fn<AdminService['uploadArtistImage']>(),
    deleteArtist: jest.fn<AdminService['deleteArtist']>(),
    uploadArtist: jest.fn<AdminService['uploadArtist']>(),
    deleteAlbum: jest.fn<AdminService['deleteAlbum']>(),
    createReferralCode: jest.fn<AdminService['createReferralCode']>(),
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

  describe('uploadArtistImage', () => {
    it('passes the id and file to the service', async () => {
      mockAdminService.uploadArtistImage.mockResolvedValue(undefined);

      await adminController.uploadArtistImage('artist-id', mockFile);

      expect(mockAdminService.uploadArtistImage).toHaveBeenCalledWith(
        'artist-id',
        mockFile,
      );
    });
  });

  describe('uploadArtist', () => {
    it('passes the files array to the service', async () => {
      await adminController.uploadArtist({ name: 'test' });

      expect(mockAdminService.uploadArtist).toHaveBeenCalledWith('test');
    });
  });

  describe('deleteArtist', () => {
    it('passes the id to the service', async () => {
      await adminController.deleteArtist('artist-id');

      expect(mockAdminService.deleteArtist).toHaveBeenCalledWith('artist-id');
    });
  });

  describe('deleteAlbum', () => {
    it('passes the id to the service', async () => {
      await adminController.deleteAlbum('album-id');

      expect(mockAdminService.deleteAlbum).toHaveBeenCalledWith('album-id');
    });
  });

  describe('createReferralCode', () => {
    it('passes the id to the service', async () => {
      await adminController.createReferralCode('user-id');

      expect(mockAdminService.createReferralCode).toHaveBeenCalledWith(
        'user-id',
      );
    });
  });
});
