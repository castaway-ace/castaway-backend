import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseFile } from 'music-metadata';
import { unlink } from 'fs/promises';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { IngestService } from '../ingest/ingest.service.js';
import { extractRequiredTags, resolveSuffix } from './metadata.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { randomUUID } from 'crypto';
import { AlbumImportPlan, ParsedTrackInput } from '../ingest/ingest.types.js';

const TRACK_UPLOAD_CONCURRENCY = 4;

interface TrackUpload {
  file: Express.Multer.File;
  fileKey: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly ingestService: IngestService,
  ) {}

  async uploadArtist(
    name: string,
    file?: Express.Multer.File,
  ): Promise<ArtistRef> {
    try {
      if (file && !file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Artist art must be an image');
      }
      const artist = await this.artistService.create({
        id: randomUUID(),
        name,
      });

      if (file) {
        try {
          await this.artistService.uploadImage(artist.id, file);
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
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Artist art must be an image');
      }

      await this.artistService.uploadImage(artistId, file);
    } finally {
      await this.cleanupFile(file);
    }
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    try {
      const parsed = await this.parseFiles(files);
      const plan = await this.ingestService.planAlbum(parsed);
      await this.uploadObjects(files, plan);
      await this.ingestService.persistImport(plan);
    } finally {
      await this.cleanupFiles(files);
    }
  }

  /**
   * Uploads the cover (if any) and every track object. Track uploads pair each
   * multer file with the plan's final object key by position. On partial
   * failure it removes whatever was uploaded and throws, leaving storage clean.
   */
  private async uploadObjects(
    files: Express.Multer.File[],
    plan: AlbumImportPlan,
  ): Promise<void> {
    if (plan.coverKey && plan.cover) {
      await this.albumService.uploadCover(plan.coverKey, plan.cover);
    }

    const uploads: TrackUpload[] = plan.tracks.map((track, index) => ({
      file: files[index],
      fileKey: track.fileKey,
    }));

    const results = await this.uploadFilesWithConcurrency(uploads);

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
      await this.ingestService.cleanupObjects(uploadedKeys, plan.coverKey);
      throw new BadRequestException({
        message: `${failures.length} of ${plan.tracks.length} tracks failed to upload`,
        failures,
      });
    }
  }

  private async uploadFilesWithConcurrency(
    uploads: TrackUpload[],
  ): Promise<PromiseSettledResult<void>[]> {
    const results: PromiseSettledResult<void>[] = Array.from(
      { length: uploads.length },
      (): PromiseSettledResult<void> => ({
        status: 'rejected',
        reason: new Error('Track upload did not run'),
      }),
    );
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= uploads.length) return;

        const { file, fileKey } = uploads[index];
        try {
          await this.trackService.uploadTrackFile(file, fileKey);
          results[index] = { status: 'fulfilled', value: undefined };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    const workerCount = Math.min(TRACK_UPLOAD_CONCURRENCY, uploads.length);
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
  ): Promise<ParsedTrackInput[]> {
    return Promise.all(
      files.map(async (file) => {
        const suffix = resolveSuffix(file.mimetype);
        return {
          tags: extractRequiredTags(await parseFile(file.path)),
          suffix,
          size: file.size,
        };
      }),
    );
  }
}
