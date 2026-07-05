import { BadRequestException } from '@nestjs/common';
import { IAudioMetadata } from 'music-metadata';
import { mimeToSuffix } from '../common/constants.js';
import { MetadataTags } from './admin.types.js';

/**
 * Resolves an uploaded file's MIME type to the storage-key suffix used for
 * track objects. Throws when the type is not a supported audio format.
 */
export function resolveSuffix(mimetype: string): string {
  const suffix = mimeToSuffix[mimetype];
  if (!suffix) {
    throw new BadRequestException(`Unsupported file type: ${mimetype}`);
  }
  return suffix;
}

/**
 * Validates and normalizes the audio tags required to import a track.
 * Kept as a pure function so every validation branch is unit-testable without
 * touching the filesystem or `music-metadata`'s `parseFile`.
 */
export function extractRequiredTags(metadata: IAudioMetadata): MetadataTags {
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
    trackNumber: track.no,
    discNumber: disk.no ?? 1,
    genres: genre,
    date: releaseDate,
    duration: Math.round(duration ?? 0),
    sampleRate: sampleRate ?? 0,
    bitDepth: bitsPerSample,
    bitRate: Math.round((bitrate ?? 0) / 1000),
    picture: picture?.[0],
  };
}
