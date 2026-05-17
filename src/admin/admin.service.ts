import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageBucket, StorageService } from '../storage/storage.service.js';
import 'multer';
import { mimeToSuffix } from '../types/constants.js';
import { IAudioMetadata, parseBuffer } from 'music-metadata';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import 'fs';
import { Track } from 'generated/prisma/client.js';

interface MetadataTags {
  title: string;
  albumTitle: string;
  albumArtistName: string;
  trackArtistNames: string[];
  trackNumber: number;
  discNumber: number;
  genres: string[];
  date: string;
  duration: number;
  sampleRate: number;
  bitDepth: number;
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

  async uploadTrack(file: Express.Multer.File): Promise<Track | null> {
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

    const newAlbum = await this.albumService.findOrCreateAlbum(
      tags.albumTitle,
      [albumArtist.id],
      tags.date,
    );

    const fileKey = `${tags.albumTitle}/${tags.title}.${suffix}`;

    await this.storageService.putObject(
      StorageBucket.Tracks,
      fileKey,
      file.buffer,
      {
        contentType: file.mimetype,
        size: file.size,
        metadata: {
          originalName: file.originalname,
        },
      },
    );

    const track = await this.trackService.createTrack({
      title: tags.title,
      albumId: newAlbum.id,
      fileKey,
      trackNumber: tags.trackNumber,
      discNumber: tags.discNumber,
      duration: tags.duration,
      size: file.size,
      codec: tags.codec,
      suffix,
      genres: tags.genres,
      bitRate: tags.bitRate,
      sampleRate: tags.sampleRate,
      bitDepth: tags.bitDepth,
      releaseDate: tags.date,
      artists: trackArtists,
    });

    return track;
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    await Promise.all(files.map((file) => this.uploadTrack(file)));
  }

  private extractRequiredTags(metadata: IAudioMetadata): MetadataTags {
    const { title, artists, albumartist, album, track, disk, date, genre } =
      metadata.common;
    const { duration, sampleRate, bitsPerSample, codec, bitrate } =
      metadata.format;

    console.log(metadata);

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
      date,
      duration: Math.round(duration ?? 0),
      sampleRate: sampleRate ?? 0,
      bitDepth: bitsPerSample,
      codec: codec ?? '',
      bitRate: Math.round((bitrate ?? 0) / 1000),
    };
  }
}
