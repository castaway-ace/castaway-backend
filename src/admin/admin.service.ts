import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import 'multer';
import { mimeToSuffix } from '../types/constants.js';
import { IAudioMetadata, parseBuffer } from 'music-metadata';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';

interface MetadataTags {
  title: string;
  albumTitle: string;
  albumArtistName: string;
  trackArtistNames: string[];
  trackNumber: number;
  discNumber: number;
  date: string | undefined;
  duration: number;
  sampleRate: number;
  bitDepth: number | undefined;
  codec: string;
  bitRate: number;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly storageService: StorageService,
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  async uploadTrack(file: Express.Multer.File): Promise<void> {
    const suffix = mimeToSuffix[file.mimetype];
    const metadata = await parseBuffer(file.buffer, file.mimetype);
    const tags = this.extractRequiredTags(metadata);

    const albumArtist = await this.artistService.findOrCreateArtist(
      tags.albumArtistName,
    );

    const trackArtists = await Promise.all(
      tags.trackArtistNames.map((name) =>
        this.artistService.findOrCreateArtist(name),
      ),
    );

    // const newAlbum = await this.albumService.findOrCreateAlbum(
    //   album,
    //   123,
    //   date,
    // );

    // const fileKey = `${album}/${title}.${suffix}`;

    // await this.storageService.putObject(
    //   StorageBucket.Tracks,
    //   fileKey,
    //   file.buffer,
    //   {
    //     contentType: file.mimetype,
    //     size: file.size,
    //     metadata: {
    //       originalName: file.originalname,
    //     },
    //   },
    // );

    // const trackData = {
    //   title,
    //   albumId: album.id,
    //   fileKey,
    //   trackNumber: metadata.common.track.no,
    //   discNumber: metadata.common.disk.no ?? 1,
    //   duration: Math.round(metadata.format.duration),
    //   size: file.size,
    //   codec: metadata.format.codec ?? '',
    //   suffix: extractSuffix(file.originalname),
    //   genres: metadata.common.genre ?? [],
    //   bitRate: Math.round(metadata.format.bitrate / 1000),
    //   sampleRate: metadata.format.sampleRate,
    //   bitDepth: metadata.format.bitsPerSample,
    //   releaseDate: parseReleaseDate(metadata.common),
    //   artists: artists,
    // };

    // const track = await this.trackService.createTrack();
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    await Promise.all(files.map((file) => this.uploadTrack(file)));
  }

  private extractRequiredTags(metadata: IAudioMetadata): MetadataTags {
    const { title, artists, albumartist, album, track, disk, date } =
      metadata.common;
    const { duration, sampleRate, bitsPerSample, codec, bitrate } =
      metadata.format;

    if (!title) throw new BadRequestException('Missing track title');
    if (!album) throw new BadRequestException('Missing album title');
    if (!albumartist) throw new BadRequestException('Missing album artist');

    const trackArtistNames = artists?.length ? artists : [albumartist];

    return {
      title,
      albumTitle: album,
      albumArtistName: albumartist,
      trackArtistNames,
      trackNumber: track.no ?? 1,
      discNumber: disk.no ?? 1,
      date,
      duration: Math.round(duration ?? 0),
      sampleRate: sampleRate ?? 0,
      bitDepth: bitsPerSample,
      codec: codec ?? '',
      bitRate: Math.round((bitrate ?? 0) / 1000),
    };
  }
}
