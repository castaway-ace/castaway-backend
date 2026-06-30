import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mimeToSuffix } from '../common/constants.js';
import { IAudioMetadata, parseFile } from 'music-metadata';
import { unlink } from 'fs/promises';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { MetadataTags, ParsedFile } from './admin.types.js';
import { buildAlbumIdentity } from '../utils/album-identity.js';
import { ReferralCodeService } from '../referral-code/referral-code.service.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { ReferralCodeEntity } from '../referral-code/referral-code.entity.js';

const TRACK_UPLOAD_CONCURRENCY = 4;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly referralCodeService: ReferralCodeService,
  ) {}

  uploadArtist(name: string): Promise<ArtistRef> {
    return this.artistService.create(name);
  }

  async deleteArtist(id: string): Promise<void> {
    await this.artistService.delete(id);
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.albumService.delete(id);
  }

  async createReferralCode(userId: string): Promise<ReferralCodeEntity> {
    return this.referralCodeService.create(userId);
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

      await this.artistService.createArtistImage(artistId, file);
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

      const firstTags = parsedFiles[0].tags;
      const albumArtistIds = this.resolveArtistIds(
        firstTags.albumArtistNames,
        artistMap,
      );

      const album = await this.albumService.create(
        firstTags.albumTitle,
        albumArtistIds,
        firstTags.date,
      );

      const picture = firstTags.picture;
      if (!album.imageKey && picture && picture.format.startsWith('image/')) {
        await this.albumService.createAlbumCover(album.id, picture);
      }

      const results = await this.uploadTracksWithConcurrency(
        parsedFiles,
        album.id,
        artistMap,
      );

      const failures = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [
              {
                trackTitle: parsedFiles[index].tags.title,
                reason:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              },
            ]
          : [],
      );

      if (failures.length > 0) {
        throw new BadRequestException({
          message: `${failures.length} of ${parsedFiles.length} tracks failed to upload`,
          failures,
        });
      }
    } finally {
      await this.cleanupFiles(files);
    }
  }

  private async uploadTracksWithConcurrency(
    parsedFiles: ParsedFile[],
    albumId: string,
    artistMap: Map<string, string>,
  ): Promise<PromiseSettledResult<void>[]> {
    const results: PromiseSettledResult<void>[] = Array.from(
      { length: parsedFiles.length },
      (): PromiseSettledResult<void> => ({
        status: 'rejected',
        reason: new Error('Track upload did not run'),
      }),
    );
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex++;
        if (index >= parsedFiles.length) return;

        const { file, tags, suffix } = parsedFiles[index];
        try {
          const trackArtistIds = this.resolveArtistIds(
            tags.trackArtistNames,
            artistMap,
          );
          await this.trackService.createTrack(
            file,
            tags,
            suffix,
            albumId,
            trackArtistIds,
          );
          results[index] = { status: 'fulfilled', value: undefined };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    const workerCount = Math.min(TRACK_UPLOAD_CONCURRENCY, parsedFiles.length);
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
