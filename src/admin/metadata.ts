import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { IAudioMetadata, IFormat } from 'music-metadata';
import {
  AUDIO_CONTENT_TYPES,
  AudioFormat,
  AudioSuffix,
  isAudioSuffix,
} from '../common/audio-formats.js';
import { MetadataTags } from './admin.types.js';

// Brands an MP4 (ISO base media) file can declare. music-metadata reports the
// major brand followed by the compatible ones, e.g. "M4A/isom/mp42" or
// "dash/iso2/mp41", so any of them can identify the file.
const MP4_BRAND =
  /^(M4A|M4B|M4P|isom|iso\d|mp4\d|dash|3gp\d|3g2\w|MSNV|F4A|F4B|qt)$/;

// Errors music-metadata and its tokenizer raise for content they can't read,
// as opposed to I/O failures on the server's side.
const UNREADABLE_AUDIO_ERRORS = new Set([
  'CouldNotDetermineFileTypeError',
  'UnsupportedFileTypeError',
  'UnexpectedFileContentError',
  'FieldDecodingError',
  'InternalParserError',
  'EndOfStreamError',
]);

/**
 * Name for an upload's temp file. The client's extension is kept when it names
 * a supported format, because music-metadata picks its parser from the
 * extension and only falls back to sniffing the first 4 KB of content, which
 * misreads files such as FLAC behind a large ID3v2 tag.
 */
export function tempUploadName(originalname: string): string {
  const extension = extname(originalname).slice(1).toLowerCase();
  return isAudioSuffix(extension)
    ? `${randomUUID()}.${extension}`
    : randomUUID();
}

/** Whether a parse error means the file itself isn't readable audio. */
export function isUnreadableAudioError(error: unknown): boolean {
  return error instanceof Error && UNREADABLE_AUDIO_ERRORS.has(error.name);
}

/**
 * Resolves the format music-metadata parsed from an upload to the suffix and
 * content type the track is stored with. Throws when the file isn't audio in a
 * supported format.
 */
export function resolveAudioFormat(format: IFormat): AudioFormat {
  if (format.hasVideo) {
    throw new BadRequestException('Video files are not supported');
  }
  if (format.hasAudio === false) {
    throw new BadRequestException('The file contains no audio');
  }

  const suffix = detectSuffix(format);
  if (!suffix) {
    const codec = format.codec ? ` (${format.codec})` : '';
    throw new BadRequestException(
      `Unsupported audio format: ${format.container ?? 'unknown'}${codec}`,
    );
  }
  return { suffix, contentType: AUDIO_CONTENT_TYPES[suffix] };
}

function detectSuffix({
  container = '',
  codec = '',
}: IFormat): AudioSuffix | undefined {
  switch (container) {
    case 'FLAC':
      return 'flac';
    case 'WAVE':
      return 'wav';
    case 'Ogg':
      return 'ogg';
    case 'MPEG':
      // Also reported for MPEG Layer I and II audio, which isn't MP3.
      return codec.endsWith('Layer 3') ? 'mp3' : undefined;
  }
  if (container.startsWith('ADTS/')) {
    return 'aac';
  }
  if (container.split('/').some((brand) => MP4_BRAND.test(brand))) {
    return 'm4a';
  }
  return undefined;
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
    year,
    genre,
    picture,
  } = metadata.common;

  const { duration, sampleRate, bitsPerSample, bitrate, lossless } =
    metadata.format;

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

  const releaseDate = parseReleaseDate(date, year);

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
    // Only lossless audio has a real bit depth; some lossy containers, such as
    // AAC in MP4, still report one.
    bitDepth: lossless && bitsPerSample ? bitsPerSample : null,
    bitRate: Math.round((bitrate ?? 0) / 1000),
    picture: picture?.[0],
  };
}

/**
 * Uses the date tag when it parses, and otherwise the year. ID3v2.3 tags only
 * carry a year, and music-metadata still finds the year in dates that `Date`
 * can't read, such as "20160501" or "2016-00-00".
 */
function parseReleaseDate(date?: string, year?: number): Date {
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (year) return new Date(Date.UTC(year, 0, 1));
  throw new BadRequestException(
    date ? `Invalid date: ${date}` : 'Missing date',
  );
}
