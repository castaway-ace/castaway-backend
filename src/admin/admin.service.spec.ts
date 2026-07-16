import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IAudioMetadata, IPicture } from 'music-metadata';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { MetadataTags } from './admin.types.js';
import type { ArtistRef } from '../common/entities/references.entity.js';

// `music-metadata`'s `parseFile` reads the disk; mock it so tests supply tags
// directly. Everything else (real temp files, real `unlink`) stays genuine so
// the cleanup paths are exercised end to end.
const parseFile = jest.fn<(path: string) => Promise<IAudioMetadata>>();
jest.unstable_mockModule('music-metadata', () => ({ parseFile }));

const { AdminService } = await import('./admin.service.js');
const { TracksService } = await import('../tracks/tracks.service.js');
const { ArtistsService } = await import('../artists/artists.service.js');
const { AlbumsService } = await import('../albums/albums.service.js');
const { PrismaService } = await import('../prisma/prisma.service.js');

function buildMetadata(overrides: {
  title?: string;
  album?: string;
  albumArtist?: string;
  artist?: string;
  trackNo?: number;
  discNo?: number;
  picture?: IPicture[];
}): IAudioMetadata {
  const albumArtist = overrides.albumArtist ?? 'Album Artist';
  return {
    common: {
      title: overrides.title ?? 'Song',
      artists: [overrides.artist ?? albumArtist],
      albumartists: [albumArtist],
      album: overrides.album ?? 'The Album',
      track: { no: overrides.trackNo ?? 1, of: 10 },
      disk: { no: overrides.discNo ?? 1, of: 1 },
      date: '2021-05-01',
      genre: ['Rock'],
      picture: overrides.picture,
    },
    format: {
      duration: 200,
      sampleRate: 44100,
      bitsPerSample: 16,
      bitrate: 900_000,
    },
  } as unknown as IAudioMetadata;
}

const cover: IPicture = {
  format: 'image/jpeg',
  data: Buffer.from('cover'),
};

describe('AdminService', () => {
  let adminService: InstanceType<typeof AdminService>;
  let tmpDir: string;

  const mockArtistService = {
    create:
      jest.fn<(data: { id: string; name: string }) => Promise<ArtistRef>>(),
    uploadImage:
      jest.fn<(id: string, file: Express.Multer.File) => Promise<void>>(),
    delete: jest.fn<(id: string) => Promise<void>>(),
    findIdsByNames:
      jest.fn<(names: string[]) => Promise<Map<string, string>>>(),
  };

  const mockAlbumService = {
    assertNotImported:
      jest.fn<(title: string, artistIds: string[]) => Promise<string>>(),
    buildCoverKey: jest.fn<(albumId: string) => string>(),
    uploadCover:
      jest.fn<(coverKey: string, picture: IPicture) => Promise<void>>(),
    create: jest.fn<() => Promise<void>>(),
    delete: jest.fn<(id: string) => Promise<void>>(),
    deleteCoverObject: jest.fn<(coverKey: string) => Promise<void>>(),
  };

  const mockTrackService = {
    deleteAlbumTrackFiles: jest.fn<(albumId: string) => Promise<void>>(),
    buildFileKey:
      jest.fn<
        (albumId: string, tags: MetadataTags, suffix: string) => string
      >(),
    uploadTrackFile:
      jest.fn<(file: Express.Multer.File, fileKey: string) => Promise<void>>(),
    create: jest.fn<() => Promise<void>>(),
    deleteTrackObjects: jest.fn<(fileKeys: string[]) => Promise<void>>(),
  };

  const mockPrisma = {
    $transaction:
      jest.fn<
        (
          fn: (tx: unknown) => Promise<unknown>,
          options?: unknown,
        ) => Promise<unknown>
      >(),
  };

  /** Writes a real temp file and registers its parsed tags for `parseFile`. */
  async function audioFile(
    name: string,
    metadata: IAudioMetadata,
    mimetype = 'audio/flac',
  ): Promise<Express.Multer.File> {
    const path = join(tmpDir, name);
    await writeFile(path, 'audio-bytes');
    parseFile.mockImplementation((p) =>
      p === path
        ? Promise.resolve(metadata)
        : Promise.reject(new Error(`unexpected parseFile(${p})`)),
    );
    return {
      path,
      originalname: name,
      mimetype,
      size: 4242,
    } as Express.Multer.File;
  }

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
    mockArtistService.findIdsByNames.mockResolvedValue(
      new Map([
        ['Album Artist', 'album-artist-id'],
        ['Artist A', 'artist-a-id'],
      ]),
    );

    mockAlbumService.assertNotImported.mockResolvedValue('identity-key');
    mockAlbumService.buildCoverKey.mockReturnValue('cover-key');
    mockAlbumService.uploadCover.mockResolvedValue(undefined);
    mockAlbumService.create.mockResolvedValue(undefined);
    mockAlbumService.delete.mockResolvedValue(undefined);
    mockAlbumService.deleteCoverObject.mockResolvedValue(undefined);

    mockTrackService.deleteAlbumTrackFiles.mockResolvedValue(undefined);
    mockTrackService.buildFileKey.mockImplementation(
      (_albumId, tags) => `file-${tags.discNumber}-${tags.trackNumber}`,
    );
    mockTrackService.uploadTrackFile.mockResolvedValue(undefined);
    mockTrackService.create.mockResolvedValue(undefined);
    mockTrackService.deleteTrackObjects.mockResolvedValue(undefined);

    mockPrisma.$transaction.mockImplementation((fn) => fn({}));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: TracksService, useValue: mockTrackService },
        { provide: ArtistsService, useValue: mockArtistService },
        { provide: AlbumsService, useValue: mockAlbumService },
        { provide: PrismaService, useValue: mockPrisma },
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

  describe('uploadAlbum', () => {
    it('throws when no files are provided', async () => {
      await expect(adminService.uploadAlbum([])).rejects.toThrow(
        'No files provided',
      );
    });

    it('rejects an unsupported file type and cleans up', async () => {
      const file = await audioFile('01.txt', buildMetadata({}), 'text/plain');

      await expect(adminService.uploadAlbum([file])).rejects.toThrow(
        'Unsupported file type: text/plain',
      );
      expect(parseFile).not.toHaveBeenCalled();
      expect(await fileExists(file.path)).toBe(false);
    });

    it('rejects when referenced artists do not exist yet', async () => {
      const file = await audioFile('01.flac', buildMetadata({}));
      mockArtistService.findIdsByNames.mockResolvedValue(new Map());

      await expect(adminService.uploadAlbum([file])).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTrackService.uploadTrackFile).not.toHaveBeenCalled();
    });

    it('rejects tracks that span multiple albums', async () => {
      const one = await audioFile(
        '01.flac',
        buildMetadata({ album: 'Album One', albumArtist: 'Artist One' }),
      );
      const two = await audioFile(
        '02.flac',
        buildMetadata({ album: 'Album Two', albumArtist: 'Artist Two' }),
      );
      parseFile.mockImplementation((p) =>
        Promise.resolve(
          p === one.path
            ? buildMetadata({ album: 'Album One', albumArtist: 'Artist One' })
            : buildMetadata({ album: 'Album Two', albumArtist: 'Artist Two' }),
        ),
      );
      mockArtistService.findIdsByNames.mockResolvedValue(
        new Map([
          ['Artist One', 'artist-one-id'],
          ['Artist Two', 'artist-two-id'],
        ]),
      );

      await expect(adminService.uploadAlbum([one, two])).rejects.toThrow(
        'Upload must contain tracks from a single album',
      );
    });

    it('rejects duplicate disc and track positions', async () => {
      const one = await audioFile(
        '01.flac',
        buildMetadata({ title: 'A', trackNo: 1 }),
      );
      const two = await audioFile(
        '02.flac',
        buildMetadata({ title: 'B', trackNo: 1 }),
      );
      parseFile.mockImplementation((p) =>
        Promise.resolve(
          p === one.path
            ? buildMetadata({ title: 'A', trackNo: 1 })
            : buildMetadata({ title: 'B', trackNo: 1 }),
        ),
      );

      await expect(adminService.uploadAlbum([one, two])).rejects.toThrow(
        'Upload contains duplicate disc and track numbers',
      );
    });

    it('uploads the cover and tracks, then persists the album', async () => {
      const file = await audioFile(
        '01.flac',
        buildMetadata({ picture: [cover] }),
      );

      await adminService.uploadAlbum([file]);

      expect(mockAlbumService.uploadCover).toHaveBeenCalledWith(
        'cover-key',
        expect.objectContaining({ format: 'image/jpeg' }),
      );
      expect(mockTrackService.uploadTrackFile).toHaveBeenCalledWith(
        file,
        'file-1-1',
      );
      expect(mockAlbumService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'The Album',
          identityKey: 'identity-key',
          imageKey: 'cover-key',
          artistIds: ['album-artist-id'],
        }),
        expect.anything(),
      );
      expect(mockTrackService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Song',
          fileKey: 'file-1-1',
          trackNumber: 1,
          artistIds: ['album-artist-id'],
        }),
        expect.anything(),
      );
      expect(mockTrackService.deleteTrackObjects).not.toHaveBeenCalled();
      expect(mockAlbumService.deleteCoverObject).not.toHaveBeenCalled();
      expect(await fileExists(file.path)).toBe(false);
    });

    it('persists without a cover when the tags carry no image', async () => {
      const file = await audioFile('01.flac', buildMetadata({}));

      await adminService.uploadAlbum([file]);

      expect(mockAlbumService.uploadCover).not.toHaveBeenCalled();
      expect(mockAlbumService.create).toHaveBeenCalledWith(
        expect.objectContaining({ imageKey: null }),
        expect.anything(),
      );
    });

    it('cleans up uploaded objects when a track upload fails', async () => {
      const one = await audioFile(
        '01.flac',
        buildMetadata({ title: 'A', trackNo: 1, picture: [cover] }),
      );
      const two = await audioFile(
        '02.flac',
        buildMetadata({ title: 'B', trackNo: 2, picture: [cover] }),
      );
      parseFile.mockImplementation((p) =>
        Promise.resolve(
          p === one.path
            ? buildMetadata({ title: 'A', trackNo: 1, picture: [cover] })
            : buildMetadata({ title: 'B', trackNo: 2, picture: [cover] }),
        ),
      );
      mockTrackService.uploadTrackFile.mockImplementation((_file, key) =>
        key === 'file-1-2'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(),
      );

      await expect(adminService.uploadAlbum([one, two])).rejects.toThrow(
        '1 of 2 tracks failed to upload',
      );
      expect(mockTrackService.deleteTrackObjects).toHaveBeenCalledWith([
        'file-1-1',
      ]);
      expect(mockAlbumService.deleteCoverObject).toHaveBeenCalledWith(
        'cover-key',
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('cleans up all objects when the transaction fails', async () => {
      const file = await audioFile(
        '01.flac',
        buildMetadata({ picture: [cover] }),
      );
      mockTrackService.create.mockRejectedValue(new Error('insert failed'));

      await expect(adminService.uploadAlbum([file])).rejects.toThrow(
        'insert failed',
      );
      expect(mockTrackService.deleteTrackObjects).toHaveBeenCalledWith([
        'file-1-1',
      ]);
      expect(mockAlbumService.deleteCoverObject).toHaveBeenCalledWith(
        'cover-key',
      );
    });

    it('uses an extended transaction timeout for large imports', async () => {
      const file = await audioFile('01.flac', buildMetadata({}));

      await adminService.uploadAlbum([file]);

      const options = mockPrisma.$transaction.mock.calls[0][1] as {
        timeout?: number;
        maxWait?: number;
      };
      // Beats Prisma's 5s default so large imports don't roll back mid-write.
      expect(options.timeout).toBeGreaterThan(5_000);
      expect(options.maxWait).toBeGreaterThan(0);
    });
  });
});
