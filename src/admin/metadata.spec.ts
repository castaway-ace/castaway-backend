import { BadRequestException } from '@nestjs/common';
import { IAudioMetadata, IPicture } from 'music-metadata';
import { extractRequiredTags, resolveSuffix } from './metadata.js';

function buildMetadata(
  common: Partial<IAudioMetadata['common']> = {},
  format: Partial<IAudioMetadata['format']> = {},
): IAudioMetadata {
  return {
    common: {
      title: 'Song',
      artists: ['Artist A'],
      albumartists: ['Album Artist'],
      album: 'The Album',
      track: { no: 3, of: 10 },
      disk: { no: 1, of: 1 },
      date: '2021-05-01',
      genre: ['Rock'],
      picture: undefined,
      ...common,
    },
    format: {
      duration: 210.4,
      sampleRate: 44100,
      bitsPerSample: 16,
      bitrate: 1_023_400,
      ...format,
    },
  } as unknown as IAudioMetadata;
}

describe('resolveSuffix', () => {
  it.each([
    ['audio/flac', 'flac'],
    ['audio/x-flac', 'flac'],
    ['audio/mpeg', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/mp4', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/ogg', 'ogg'],
  ])('maps %s to %s', (mimetype, expected) => {
    expect(resolveSuffix(mimetype)).toBe(expected);
  });

  it('throws for an unsupported type', () => {
    expect(() => resolveSuffix('image/png')).toThrow(BadRequestException);
    expect(() => resolveSuffix('image/png')).toThrow(
      'Unsupported file type: image/png',
    );
  });
});

describe('extractRequiredTags', () => {
  it('normalizes a complete metadata object', () => {
    const tags = extractRequiredTags(buildMetadata());

    expect(tags).toEqual({
      title: 'Song',
      albumTitle: 'The Album',
      albumArtistNames: ['Album Artist'],
      trackArtistNames: ['Artist A'],
      trackNumber: 3,
      discNumber: 1,
      genres: ['Rock'],
      date: new Date('2021-05-01'),
      duration: 210, // rounded
      sampleRate: 44100,
      bitDepth: 16,
      bitRate: 1023, // rounded bitrate / 1000
      picture: undefined,
    });
  });

  it('defaults the disc number to 1 when absent', () => {
    const tags = extractRequiredTags(
      buildMetadata({ disk: { no: null, of: null } }),
    );
    expect(tags.discNumber).toBe(1);
  });

  it('defaults duration, sample rate and bit rate to 0 when absent', () => {
    const tags = extractRequiredTags(
      buildMetadata(
        {},
        { duration: undefined, sampleRate: undefined, bitrate: undefined },
      ),
    );
    expect(tags.duration).toBe(0);
    expect(tags.sampleRate).toBe(0);
    expect(tags.bitRate).toBe(0);
  });

  it('selects the first embedded picture', () => {
    const picture = {
      format: 'image/jpeg',
      data: Buffer.from('a'),
    } as IPicture;
    const other = { format: 'image/png', data: Buffer.from('b') } as IPicture;
    const tags = extractRequiredTags(
      buildMetadata({ picture: [picture, other] }),
    );
    expect(tags.picture).toBe(picture);
  });

  it.each([
    [{ title: undefined }, 'Missing track title'],
    [{ album: undefined }, 'Missing album title'],
    [{ albumartists: [] }, 'Missing album artists'],
    [{ albumartists: undefined }, 'Missing album artists'],
    [{ artists: [] }, 'Missing track artists'],
    [{ artists: undefined }, 'Missing track artists'],
    [{ genre: [] }, 'Missing genres'],
    [{ genre: undefined }, 'Missing genres'],
    [{ date: undefined }, 'Missing date'],
  ])('rejects when %o is invalid', (common, message) => {
    expect(() => extractRequiredTags(buildMetadata(common))).toThrow(message);
  });

  it('rejects a missing bit depth', () => {
    expect(() =>
      extractRequiredTags(buildMetadata({}, { bitsPerSample: undefined })),
    ).toThrow('Missing bit depth');
  });

  it('rejects an unparseable date', () => {
    expect(() =>
      extractRequiredTags(buildMetadata({ date: 'not-a-real-date' })),
    ).toThrow('Invalid date: not-a-real-date');
  });

  it('rejects a missing track number', () => {
    expect(() =>
      extractRequiredTags(buildMetadata({ track: { no: null, of: 10 } })),
    ).toThrow('Missing track number');
  });
});
