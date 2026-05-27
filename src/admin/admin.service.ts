import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import { mimeToSuffix } from '../types/constants.js';
import { IAudioMetadata, IPicture, parseBuffer } from 'music-metadata';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { Album, Artist, Track } from 'generated/prisma/client.js';
import { StorageBucket } from '../types/storage.js';

interface MetadataTags {
  title: string;
  albumTitle: string;
  albumArtistName: string;
  trackArtistNames: string[];
  trackNumber: number;
  discNumber: number;
  genres: string[];
  date: Date;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  bitRate: number;
  picture: IPicture | undefined;
}

interface ParsedFile {
  file: Express.Multer.File;
  tags: MetadataTags;
  suffix: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly storageService: StorageService,
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const parsedFiles: ParsedFile[] = await Promise.all(
      files.map(async (file) => ({
        file,
        tags: this.extractRequiredTags(
          await parseBuffer(file.buffer, file.mimetype),
        ),
        suffix: mimeToSuffix[file.mimetype],
      })),
    );

    this.validateSingleAlbum(parsedFiles);

    const uniqueArtistNames = new Set<string>();
    for (const { tags } of parsedFiles) {
      uniqueArtistNames.add(tags.albumArtistName);
      for (const name of tags.trackArtistNames) {
        uniqueArtistNames.add(name);
      }
    }

    const artistMap = new Map<string, Artist>();
    for (const name of uniqueArtistNames) {
      const artist = await this.artistService.findOrCreateArtist(name);
      artistMap.set(name, artist);
    }

    const firstTags = parsedFiles[0].tags;
    const albumArtist = artistMap.get(firstTags.albumArtistName)!;
    const album = await this.albumService.findOrCreateAlbum(
      firstTags.albumTitle,
      [albumArtist.id],
      firstTags.date,
    );

    const picture = firstTags.picture;

    if (!album.imageKey && picture && picture.format.startsWith('image/')) {
      const fileKey = `${album.id}/cover.jpg`;
      const coverBuffer = Buffer.from(picture.data);

      try {
        await this.storageService.putObject(
          StorageBucket.AlbumArt,
          fileKey,
          coverBuffer,
          {
            contentType: picture.format,
            size: coverBuffer.length,
            metadata: { source: 'embedded' },
          },
        );

        await this.albumService.updateAlbum(album.id, fileKey);
      } catch (err) {
        console.error('Cover upload failed', err);
      }
    }

    const results = await Promise.allSettled(
      parsedFiles.map(({ file, tags, suffix }) =>
        this.uploadTrackFile(file, tags, suffix, album, artistMap),
      ),
    );

    const failures: { trackTitle: string; reason: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failures.push({
          trackTitle: parsedFiles[index].tags.title,
          reason:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    if (failures.length > 0) {
      throw new BadRequestException({
        message: `${failures.length} of ${parsedFiles.length} tracks failed to upload`,
        failures,
      });
    }
  }

  private validateSingleAlbum(parsedFiles: ParsedFile[]): void {
    const albumIdentities = new Set(
      parsedFiles.map(
        ({ tags }) => `${tags.albumTitle}::${tags.albumArtistName}`,
      ),
    );

    if (albumIdentities.size > 1) {
      const albums = parsedFiles.map(
        ({ tags }) => `"${tags.albumTitle}" by ${tags.albumArtistName}`,
      );
      const unique = [...new Set(albums)];
      throw new BadRequestException({
        message: 'Upload must contain tracks from a single album',
        foundAlbums: unique,
      });
    }
  }

  private async uploadTrackFile(
    file: Express.Multer.File,
    tags: MetadataTags,
    suffix: string,
    album: Album,
    artistMap: Map<string, Artist>,
  ): Promise<Track | null> {
    const fileKey = `${album.id}/${tags.discNumber}-${String(tags.trackNumber).padStart(2, '0')}.${suffix}`;

    await this.storageService.putObject(
      StorageBucket.Tracks,
      fileKey,
      file.buffer,
      {
        contentType: file.mimetype,
        size: file.size,
        metadata: { originalName: file.originalname },
      },
    );

    const trackArtists = tags.trackArtistNames.map(
      (name) => artistMap.get(name)!,
    );

    return this.trackService.createTrack({
      title: tags.title,
      albumId: album.id,
      fileKey,
      trackNumber: tags.trackNumber,
      discNumber: tags.discNumber,
      duration: tags.duration,
      size: file.size,
      suffix,
      genres: tags.genres,
      bitRate: tags.bitRate,
      sampleRate: tags.sampleRate,
      bitDepth: tags.bitDepth,
      releaseDate: tags.date,
      artists: trackArtists,
    });
  }

  private extractRequiredTags(metadata: IAudioMetadata): MetadataTags {
    const {
      title,
      artists,
      albumartist,
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
    if (!albumartist) throw new BadRequestException('Missing album artist');
    if (!artists) throw new BadRequestException('Missing track artists');
    if (!date) throw new BadRequestException('Missing date');
    if (!bitsPerSample) throw new BadRequestException('Missing bit depth');
    if (!genre) throw new BadRequestException('Missing genres');

    return {
      title,
      albumTitle: album,
      albumArtistName: albumartist,
      trackArtistNames: artists,
      trackNumber: track.no ?? 1,
      discNumber: disk.no ?? 1,
      genres: genre,
      date: new Date(date),
      duration: Math.round(duration ?? 0),
      sampleRate: sampleRate ?? 0,
      bitDepth: bitsPerSample ?? 0,
      bitRate: Math.round((bitrate ?? 0) / 1000),
      picture: picture?.[0],
    };
  }
}
