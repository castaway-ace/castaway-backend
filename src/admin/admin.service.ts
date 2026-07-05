import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mimeToSuffix } from '../common/constants.js';
import { IAudioMetadata, parseFile } from 'music-metadata';
import { unlink } from 'fs/promises';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { MetadataTags, ParsedFile } from './admin.types.js';
import { buildAlbumIdentity } from '../common/album-identity.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const TRACK_UPLOAD_CONCURRENCY = 4;

interface TrackUploadPlan extends ParsedFile {
  fileKey: string;
  trackArtistIds: string[];
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

      const picture = firstTags.picture;
      const hasCover =
        picture !== undefined && picture.format.startsWith('image/');
      const coverKey = hasCover
        ? this.albumService.buildCoverKey(albumId)
        : null;

      const plans: TrackUploadPlan[] = parsedFiles.map((parsed) => ({
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

      if (coverKey && picture) {
        await this.albumService.uploadCover(coverKey, picture);
      }

      const results = await this.uploadFilesWithConcurrency(plans);

      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [
              {
                trackTitle: plans[index].tags.title,
                reason:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              },
            ]
          : [],
      );

      if (failures.length > 0) {
        const uploadedKeys = plans
          .filter((_, index) => results[index].status === 'fulfilled')
          .map((plan) => plan.fileKey);
        await this.cleanupObjects(uploadedKeys, coverKey);
        throw new BadRequestException({
          message: `${failures.length} of ${plans.length} tracks failed to upload`,
          failures,
        });
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          await this.albumService.create(
            {
              id: albumId,
              title: firstTags.albumTitle,
              releaseDate: firstTags.date,
              identityKey,
              imageKey: coverKey,
              artistIds: albumArtistIds,
            },
            tx,
          );

          for (const plan of plans) {
            await this.trackService.create(
              {
                title: plan.tags.title,
                albumId,
                fileKey: plan.fileKey,
                trackNumber: plan.tags.trackNumber,
                discNumber: plan.tags.discNumber,
                duration: plan.tags.duration,
                size: plan.file.size,
                suffix: plan.suffix,
                genres: plan.tags.genres,
                bitRate: plan.tags.bitRate,
                sampleRate: plan.tags.sampleRate,
                bitDepth: plan.tags.bitDepth,
                releaseDate: plan.tags.date,
                artistIds: plan.trackArtistIds,
              },
              tx,
            );
          }
        });
      } catch (error) {
        await this.cleanupObjects(
          plans.map((plan) => plan.fileKey),
          coverKey,
        );
        throw error;
      }
    } finally {
      await this.cleanupFiles(files);
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

        const { file, fileKey } = plans[index];
        try {
          await this.trackService.uploadTrackFile(file, fileKey);
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
        const suffix = mimeToSuffix[file.mimetype];
        if (!suffix) {
          throw new BadRequestException(
            `Unsupported file type: ${file.mimetype}`,
          );
        }
        return {
          file,
          tags: this.extractRequiredTags(await parseFile(file.path)),
          suffix,
        };
      }),
    );
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

  private extractRequiredTags(metadata: IAudioMetadata): MetadataTags {
    const {
      title,
      artists,
      albumartists,
      album,
      track,
      disk,
      date,
      genre,
      picture,
    } = metadata.common;

    const { duration, sampleRate, bitsPerSample, bitrate } = metadata.format;

    if (!title) throw new BadRequestException('Missing track title');
    if (!album) throw new BadRequestException('Missing album title');
    if (!albumartists || albumartists.length === 0) {
      throw new BadRequestException('Missing album artists');
    }
    if (!artists || artists.length === 0) {
      throw new BadRequestException('Missing track artists');
    }
    if (!genre || genre.length === 0) {
      throw new BadRequestException('Missing genres');
    }
    if (!date) throw new BadRequestException('Missing date');
    if (!bitsPerSample) throw new BadRequestException('Missing bit depth');

    const releaseDate = new Date(date);
    if (Number.isNaN(releaseDate.getTime())) {
      throw new BadRequestException(`Invalid date: ${date}`);
    }

    if (track.no === null || track.no === undefined) {
      throw new BadRequestException('Missing track number');
    }

    return {
      title,
      albumTitle: album,
      albumArtistNames: albumartists,
      trackArtistNames: artists,
      trackNumber: track.no ?? 1,
      discNumber: disk.no ?? 1,
      genres: genre,
      date: releaseDate,
      duration: Math.round(duration ?? 0),
      sampleRate: sampleRate ?? 0,
      bitDepth: bitsPerSample ?? 0,
      bitRate: Math.round((bitrate ?? 0) / 1000),
      picture: picture?.[0],
    };
  }
}
