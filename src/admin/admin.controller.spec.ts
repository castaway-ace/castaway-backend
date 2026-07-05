import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';

describe('AdminController', () => {
  let adminController: AdminController;

  const mockAdminService = {
    uploadAlbum: jest.fn<AdminService['uploadAlbum']>(),
    uploadArtistImage: jest.fn<AdminService['uploadArtistImage']>(),
    deleteArtist: jest.fn<AdminService['deleteArtist']>(),
    uploadArtist: jest.fn<AdminService['uploadArtist']>(),
    deleteAlbum: jest.fn<AdminService['deleteAlbum']>(),
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
    }).compile();

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

      expect(mockAdminService.uploadArtist).toHaveBeenCalledWith(
        'test',
        undefined,
      );
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
});
