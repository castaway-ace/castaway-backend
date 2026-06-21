import { BadRequestException, Injectable } from '@nestjs/common';
import { mimeToSuffix } from '../types/constants.js';
import { IAudioMetadata, parseBuffer } from 'music-metadata';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { MetadataTags, ParsedFile } from '../types/admin.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  async uploadArtist(name: string) {
    await this.artistService.create(name);
  }

  async deleteArtist(id: string) {
    await this.artistService.delete(id);
  }

  async deleteAlbum(id: string) {
    await this.albumService.delete(id);
  }

  async uploadArtistArt(
    artistId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Artist art must be an image');
    }

    await this.artistService.setArtistArt(artistId, file);
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const parsedFiles = await this.parseFiles(files);

    this.validateSingleAlbum(parsedFiles);

    const artistMap = await this.resolveArtistMap(parsedFiles);

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
      await this.albumService.setAlbumCover(album.id, picture);
    }

    const results = await Promise.allSettled(
      parsedFiles.map(({ file, tags, suffix }) => {
        const trackArtistIds = this.resolveArtistIds(
          tags.trackArtistNames,
          artistMap,
        );
        return this.trackService.setTrack(
          file,
          tags,
          suffix,
          album.id,
          trackArtistIds,
        );
      }),
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
          tags: this.extractRequiredTags(
            await parseBuffer(file.buffer, file.mimetype),
          ),
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

  private validateSingleAlbum(parsedFiles: ParsedFile[]): void {
    const identityOf = (tags: MetadataTags): string =>
      `${tags.albumTitle}::${[...tags.albumArtistNames].sort().join('\u0000')}`;

    const identities = new Set(parsedFiles.map(({ tags }) => identityOf(tags)));

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
