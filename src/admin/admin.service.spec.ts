import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AdminService } from './admin.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import type { ArtistRef } from '../common/entities/references.entity.js';

describe('AdminService', () => {
  let adminService: AdminService;
  let tmpDir: string;

  const mockArtistService = {
    create:
      jest.fn<(data: { id: string; name: string }) => Promise<ArtistRef>>(),
    uploadImage:
      jest.fn<(id: string, file: Express.Multer.File) => Promise<void>>(),
    delete: jest.fn<(id: string) => Promise<void>>(),
  };

  const mockAlbumService = {
    delete: jest.fn<(id: string) => Promise<void>>(),
  };

  const mockTrackService = {
    deleteAlbumTrackFiles: jest.fn<(albumId: string) => Promise<void>>(),
  };

  const imageFile = (mimetype = 'image/jpeg'): Express.Multer.File =>
    ({
      path: join(tmpDir, 'art.jpg'),
      originalname: 'art.jpg',
      mimetype,
      size: 128,
    }) as Express.Multer.File;

  const fileExists = async (path: string): Promise<boolean> =>
    access(path).then(
      () => true,
      () => false,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), 'admin-spec-'));

    mockArtistService.create.mockImplementation((data) =>
      Promise.resolve({ id: data.id, name: data.name, isVarious: false }),
    );
    mockArtistService.uploadImage.mockResolvedValue(undefined);
    mockArtistService.delete.mockResolvedValue(undefined);
    mockAlbumService.delete.mockResolvedValue(undefined);
    mockTrackService.deleteAlbumTrackFiles.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: TracksService, useValue: mockTrackService },
        { provide: ArtistsService, useValue: mockArtistService },
        { provide: AlbumsService, useValue: mockAlbumService },
      ],
    }).compile();

    adminService = module.get(AdminService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('uploadArtist', () => {
    it('creates an artist without an image', async () => {
      const result = await adminService.uploadArtist('Nina');

      expect(mockArtistService.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nina' }),
      );
      expect(mockArtistService.uploadImage).not.toHaveBeenCalled();
      expect(result.name).toBe('Nina');
      expect(typeof result.id).toBe('string');
    });

    it('uploads the image and cleans up the temp file', async () => {
      const file = imageFile();
      await writeFile(file.path, 'img');

      await adminService.uploadArtist('Nina', file);

      expect(mockArtistService.uploadImage).toHaveBeenCalledWith(
        expect.any(String),
        file,
      );
      expect(await fileExists(file.path)).toBe(false);
    });

    it('rejects a non-image file before creating anything', async () => {
      const file = imageFile('text/plain');
      await writeFile(file.path, 'nope');

      await expect(adminService.uploadArtist('Nina', file)).rejects.toThrow(
        'Artist art must be an image',
      );
      expect(mockArtistService.create).not.toHaveBeenCalled();
      expect(await fileExists(file.path)).toBe(false);
    });

    it('rolls back the artist when the image upload fails', async () => {
      const file = imageFile();
      await writeFile(file.path, 'img');
      mockArtistService.uploadImage.mockRejectedValue(new Error('s3 down'));

      await expect(adminService.uploadArtist('Nina', file)).rejects.toThrow(
        's3 down',
      );
      expect(mockArtistService.delete).toHaveBeenCalledWith(expect.any(String));
      expect(await fileExists(file.path)).toBe(false);
    });
  });

  describe('uploadArtistImage', () => {
    it('throws when no file is provided', async () => {
      await expect(
        adminService.uploadArtistImage(
          'artist-1',
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow('No file provided');
      expect(mockArtistService.uploadImage).not.toHaveBeenCalled();
    });

    it('rejects a non-image file and cleans up', async () => {
      const file = imageFile('application/pdf');
      await writeFile(file.path, 'pdf');

      await expect(
        adminService.uploadArtistImage('artist-1', file),
      ).rejects.toThrow('Artist art must be an image');
      expect(mockArtistService.uploadImage).not.toHaveBeenCalled();
      expect(await fileExists(file.path)).toBe(false);
    });

    it('delegates to the artist service and cleans up', async () => {
      const file = imageFile();
      await writeFile(file.path, 'img');

      await adminService.uploadArtistImage('artist-1', file);

      expect(mockArtistService.uploadImage).toHaveBeenCalledWith(
        'artist-1',
        file,
      );
      expect(await fileExists(file.path)).toBe(false);
    });
  });

  describe('deleteArtist', () => {
    it('delegates to the artist service', async () => {
      await adminService.deleteArtist('artist-1');
      expect(mockArtistService.delete).toHaveBeenCalledWith('artist-1');
    });
  });

  describe('deleteAlbum', () => {
    it('deletes track files before the album record', async () => {
      await adminService.deleteAlbum('album-1');

      expect(mockTrackService.deleteAlbumTrackFiles).toHaveBeenCalledWith(
        'album-1',
      );
      expect(mockAlbumService.delete).toHaveBeenCalledWith('album-1');
      expect(
        mockTrackService.deleteAlbumTrackFiles.mock.invocationCallOrder[0],
      ).toBeLessThan(mockAlbumService.delete.mock.invocationCallOrder[0]);
    });
  });
});
