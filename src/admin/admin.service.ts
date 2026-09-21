import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  IAudioMetadata,
  IPicture,
  parseFile,
  parseStream,
} from 'music-metadata';
import { open, unlink } from 'fs/promises';
import { extname } from 'path';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { ParsedFile } from './admin.types.js';
import {
  extractRequiredTags,
  isUnreadableAudioError,
  resolveAudioFormat,
} from './metadata.js';
import { buildAlbumIdentity } from '../common/album-identity.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectImageFileType, detectImageType } from '../common/image-type.js';

const TRACK_UPLOAD_CONCURRENCY = 4;

const IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;

interface TrackUploadPlan extends ParsedFile {
  fileKey: string;
  trackArtistIds: string[];
}

interface AlbumImportPlan {
  albumId: string;
  identityKey: string;
  albumTitle: string;
  releaseDate: Date;
  albumArtistIds: string[];
  coverKey: string | null;
  cover: IPicture | undefined;
  tracks: TrackUploadPlan[];
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadArtist(
    name: string,
    file?: Express.Multer.File,
  ): Promise<ArtistRef> {
    try {
      const image = file && (await this.requireImage(file));
      const artist = await this.artistService.create({
        id: randomUUID(),
        name,
      });

      if (image) {
        try {
          await this.artistService.uploadImage(artist.id, image);
        } catch (error) {
          await this.artistService
            .delete(artist.id)
            .catch((cleanupError: unknown) =>
              this.logger.warn(
                `Failed to roll back artist ${artist.id} after image upload failure: ${
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError)
                }`,
              ),
            );
          throw error;
        }
      }

      return artist;
    } finally {
      if (file) {
        await this.cleanupFile(file);
      }
    }
  }

  async deleteArtist(id: string): Promise<void> {
    await this.artistService.delete(id);
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.trackService.deleteAlbumTrackFiles(id);
    await this.albumService.delete(id);
  }

  async uploadArtistImage(
    artistId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      await this.artistService.uploadImage(
        artistId,
        await this.requireImage(file),
      );
    } finally {
      await this.cleanupFile(file);
    }
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    try {
      const plan = await this.buildImportPlan(files);
      await this.uploadObjects(plan);
      await this.persistImport(plan);
    } finally {
      await this.cleanupFiles(files);
    }
  }

  /**
   * Parses and validates the upload, resolves artists, and produces the set of
   * object keys and DB rows to write. Pure planning: no storage or DB writes.
   */
  private async buildImportPlan(
    files: Express.Multer.File[],
  ): Promise<AlbumImportPlan> {
    const parsedFiles = await this.parseFiles(files);
    const artistMap = await this.resolveArtistMap(parsedFiles);
    this.validateSingleAlbum(parsedFiles, artistMap);
    this.validateUniqueTrackPositions(parsedFiles);

    const firstTags = parsedFiles[0].tags;
    const albumArtistIds = this.resolveArtistIds(
      firstTags.albumArtistNames,
      artistMap,
    );

    const identityKey = await this.albumService.assertNotImported(
      firstTags.albumTitle,
      albumArtistIds,
    );

    const albumId = randomUUID();

    const cover = this.embeddedCover(firstTags.picture);
    const coverKey = cover ? this.albumService.buildCoverKey(albumId) : null;

    const tracks: TrackUploadPlan[] = parsedFiles.map((parsed) => ({
      ...parsed,
      fileKey: this.trackService.buildFileKey(
        albumId,
        parsed.tags,
        parsed.suffix,
      ),
      trackArtistIds: this.resolveArtistIds(
        parsed.tags.trackArtistNames,
        artistMap,
      ),
    }));

    return {
      albumId,
      identityKey,
      albumTitle: firstTags.albumTitle,
      releaseDate: firstTags.date,
      albumArtistIds,
      coverKey,
      cover,
      tracks,
    };
  }

  /**
   * Uploads the cover (if any) and every track object. On partial failure it
   * removes whatever was uploaded and throws, leaving storage clean.
   */
  private async uploadObjects(plan: AlbumImportPlan): Promise<void> {
    if (plan.coverKey && plan.cover) {
      await this.albumService.uploadCover(plan.coverKey, plan.cover);
    }

    const results = await this.uploadFilesWithConcurrency(plan.tracks);

    const failures = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [
            {
              trackTitle: plan.tracks[index].tags.title,
              reason:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
          ]
        : [],
    );

    if (failures.length > 0) {
      const uploadedKeys = plan.tracks
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((track) => track.fileKey);
      await this.cleanupObjects(uploadedKeys, plan.coverKey);
      throw new BadRequestException({
        message: `${failures.length} of ${plan.tracks.length} tracks failed to upload`,
        failures,
      });
    }
  }

  /**
   * Persists the album and its tracks in a single transaction. If the write
   * fails, the already-uploaded objects are removed before rethrowing.
   */
  private async persistImport(plan: AlbumImportPlan): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.albumService.create(
            {
              id: plan.albumId,
              title: plan.albumTitle,
              releaseDate: plan.releaseDate,
              identityKey: plan.identityKey,
              imageKey: plan.coverKey,
              artistIds: plan.albumArtistIds,
            },
            tx,
          );

          for (const track of plan.tracks) {
            await this.trackService.create(
              {
                title: track.tags.title,
                albumId: plan.albumId,
                fileKey: track.fileKey,
                trackNumber: track.tags.trackNumber,
                discNumber: track.tags.discNumber,
                duration: track.tags.duration,
                size: track.file.size,
                suffix: track.suffix,
                genres: track.tags.genres,
                bitRate: track.tags.bitRate,
                sampleRate: track.tags.sampleRate,
                bitDepth: track.tags.bitDepth,
                releaseDate: track.tags.date,
                artistIds: track.trackArtistIds,
              },
              tx,
            );
          }
        },
        {
          timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
          maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
        },
      );
    } catch (error) {
      await this.cleanupObjects(
        plan.tracks.map((track) => track.fileKey),
        plan.coverKey,
      );
      throw error;
    }
  }

  private async cleanupObjects(
    trackKeys: string[],
    coverKey: string | null,
  ): Promise<void> {
    await this.trackService.deleteTrackObjects(trackKeys);
    if (coverKey) {
      await this.albumService.deleteCoverObject(coverKey);
    }
  }

  private async uploadFilesWithConcurrency(
    plans: TrackUploadPlan[],
  ): Promise<PromiseSettledResult<void>[]> {
    const results: PromiseSettledResult<void>[] = Array.from(
      { length: plans.length },
      (): PromiseSettledResult<void> => ({
        status: 'rejected',
        reason: new Error('Track upload did not run'),
      }),
    );
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= plans.length) return;

        const { file, fileKey, contentType } = plans[index];
        try {
          await this.trackService.uploadTrackFile(file, fileKey, contentType);
          results[index] = { status: 'fulfilled', value: undefined };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    const workerCount = Math.min(TRACK_UPLOAD_CONCURRENCY, plans.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  private async cleanupFiles(files: Express.Multer.File[]): Promise<void> {
    await Promise.all(files.map((file) => this.cleanupFile(file)));
  }

  private async cleanupFile(file: Express.Multer.File): Promise<void> {
    if (!file.path) return;
    try {
      await unlink(file.path);
    } catch (error) {
      this.logger.warn(
        `Failed to clean up upload file ${file.path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async parseFiles(
    files: Express.Multer.File[],
  ): Promise<ParsedFile[]> {
    return Promise.all(
      files.map(async (file) => {
        try {
          const metadata = await this.parseAudioFile(file.path);
          return {
            file,
            tags: extractRequiredTags(metadata),
            ...resolveAudioFormat(metadata.format),
          };
        } catch (error) {
          // Name the file, since an album can have up to 200 of them.
          if (error instanceof BadRequestException) {
            throw new BadRequestException(
              `${file.originalname}: ${error.message}`,
              { cause: error },
            );
          }
          throw error;
        }
      }),
    );
  }

  /**
   * Parses an uploaded temp file. Its extension, kept from the client's
   * filename, lets music-metadata pick the right parser. A mislabeled file
   * fails that parser, so it is parsed again from its contents alone. Only
   * content that can't be read becomes a 400; I/O errors stay server errors.
   */
  private async parseAudioFile(path: string): Promise<IAudioMetadata> {
    let error: unknown;
    try {
      return await parseFile(path);
    } catch (parseError) {
      error = parseError;
    }

    if (isUnreadableAudioError(error) && extname(path)) {
      // A stream opened from a path would hand music-metadata the extension
      // again, so it reads from a file handle and only gets the size.
      const file = await open(path);
      const stream = file.createReadStream({ autoClose: false });
      try {
        const { size } = await file.stat();
        return await parseStream(stream, { size });
      } catch (retryError) {
        error = retryError;
      } finally {
        stream.destroy();
        await file.close();
      }
    }

    if (isUnreadableAudioError(error)) {
      throw new BadRequestException('Not a readable audio file', {
        cause: error,
      });
    }
    throw error;
  }

  /**
   * Checks that an uploaded artist image really is an image, whatever type the
   * client declared, and returns the file labeled with its detected type.
   */
  private async requireImage(
    file: Express.Multer.File,
  ): Promise<Express.Multer.File> {
    const mimetype = await detectImageFileType(file.path);
    if (!mimetype) {
      throw new BadRequestException(
        'Artist art must be an image (JPEG, PNG, GIF or WebP)',
      );
    }
    return { ...file, mimetype };
  }

  /**
   * Returns the embedded cover labeled with its detected type, or `undefined`
   * when there is none or it isn't a supported image. Tags can declare any
   * type, so the album is imported without a cover rather than storing it.
   */
  private embeddedCover(picture: IPicture | undefined): IPicture | undefined {
    const format = picture && detectImageType(picture.data);
    return picture && format ? { ...picture, format } : undefined;
  }

  private async resolveArtistMap(
    parsedFiles: ParsedFile[],
  ): Promise<Map<string, string>> {
    const names = new Set<string>();
    for (const { tags } of parsedFiles) {
      for (const name of tags.albumArtistNames) names.add(name);
      for (const name of tags.trackArtistNames) names.add(name);
    }

    const found = await this.artistService.findIdsByNames([...names]);

    const missing = [...names].filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `${missing.length} artist(s) must be created before uploading`,
        missingArtists: missing,
      });
    }

    return found;
  }

  private resolveArtistIds(
    names: string[],
    artistMap: Map<string, string>,
  ): string[] {
    return names.map((name) => {
      const id = artistMap.get(name);
      if (!id) {
        throw new BadRequestException(`Artist could not be resolved: ${name}`);
      }
      return id;
    });
  }

  private validateSingleAlbum(
    parsedFiles: ParsedFile[],
    artistMap: Map<string, string>,
  ): void {
    const identities = new Set(
      parsedFiles.map(({ tags }) => {
        const albumArtistIds = this.resolveArtistIds(
          tags.albumArtistNames,
          artistMap,
        );
        return buildAlbumIdentity(tags.albumTitle, albumArtistIds);
      }),
    );

    if (identities.size > 1) {
      const found = [
        ...new Set(
          parsedFiles.map(
            ({ tags }) =>
              `"${tags.albumTitle}" by ${tags.albumArtistNames.join(', ')}`,
          ),
        ),
      ];
      throw new BadRequestException({
        message: 'Upload must contain tracks from a single album',
        foundAlbums: found,
      });
    }
  }

  private validateUniqueTrackPositions(parsedFiles: ParsedFile[]): void {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const { tags } of parsedFiles) {
      const key = `${tags.discNumber}-${tags.trackNumber}`;
      const existingTitle = seen.get(key);
      if (existingTitle !== undefined) {
        collisions.push(
          `Disc ${tags.discNumber}, track ${tags.trackNumber}: "${existingTitle}" and "${tags.title}"`,
        );
      } else {
        seen.set(key, tags.title);
      }
    }

    if (collisions.length > 0) {
      throw new BadRequestException({
        message: 'Upload contains duplicate disc and track numbers',
        collisions,
      });
    }
  }
}
