import { BadRequestException } from '@nestjs/common';
import {
  CouldNotDetermineFileTypeError,
  IAudioMetadata,
  IFormat,
  IPicture,
  UnexpectedFileContentError,
} from 'music-metadata';
import {
  extractRequiredTags,
  isUnreadableAudioError,
  resolveAudioFormat,
  tempUploadName,
} from './metadata.js';

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
      lossless: true,
      bitrate: 1_023_400,
      ...format,
    },
  } as unknown as IAudioMetadata;
}

describe('resolveAudioFormat', () => {
  const format = (overrides: Partial<IFormat>) => overrides as IFormat;

  // Containers and codecs as music-metadata reports them for real files.
  it.each([
    ['FLAC', 'FLAC', 'flac', 'audio/flac'],
    ['MPEG', 'MPEG 1 Layer 3', 'mp3', 'audio/mpeg'],
    ['MPEG', 'MPEG 2.5 Layer 3', 'mp3', 'audio/mpeg'],
    ['WAVE', 'PCM', 'wav', 'audio/wav'],
    ['ADTS/MPEG-4', 'AAC', 'aac', 'audio/aac'],
    ['ADTS/MPEG-2', 'AAC', 'aac', 'audio/aac'],
    ['Ogg', 'Vorbis I', 'ogg', 'audio/ogg'],
    ['M4A/isom/mp42', 'MPEG-4/AAC', 'm4a', 'audio/mp4'],
    ['M4A/isom/iso2', 'ALAC', 'm4a', 'audio/mp4'],
    ['isom/iso2/mp41', 'MPEG-4/AAC', 'm4a', 'audio/mp4'],
    // Major brands other than M4A/isom, with a known brand later in the list.
    ['dash/iso2/mp41', 'MPEG-4/AAC', 'm4a', 'audio/mp4'],
    ['3gp5/3gp4/isom', 'MPEG-4/AAC', 'm4a', 'audio/mp4'],
    ['MSNV/mp42/isom', 'MPEG-4/AAC', 'm4a', 'audio/mp4'],
  ])('maps %s (%s) to %s', (container, codec, suffix, contentType) => {
    expect(resolveAudioFormat(format({ container, codec }))).toEqual({
      suffix,
      contentType,
    });
  });

  it('throws for an unsupported format', () => {
    const aiff = format({ container: 'AIFF', codec: 'PCM' });
    expect(() => resolveAudioFormat(aiff)).toThrow(BadRequestException);
    expect(() => resolveAudioFormat(aiff)).toThrow(
      'Unsupported audio format: AIFF (PCM)',
    );
  });

  it('throws when no container was detected', () => {
    expect(() => resolveAudioFormat(format({}))).toThrow(
      'Unsupported audio format: unknown',
    );
  });

  it('rejects MPEG Layer II audio, which is not MP3', () => {
    expect(() =>
      resolveAudioFormat(
        format({ container: 'MPEG', codec: 'MPEG 1 Layer 2' }),
      ),
    ).toThrow('Unsupported audio format: MPEG (MPEG 1 Layer 2)');
  });

  it.each([
    ['a music video', 'isom/iso2/avc1/mp41'],
    ['an Ogg Theora video', 'Ogg'],
  ])('rejects %s', (_label, container) => {
    expect(() =>
      resolveAudioFormat(format({ container, hasVideo: true })),
    ).toThrow('Video files are not supported');
  });

  it('rejects a file with no audio track', () => {
    expect(() =>
      resolveAudioFormat(format({ container: 'M4A/isom', hasAudio: false })),
    ).toThrow('The file contains no audio');
  });
});

describe('tempUploadName', () => {
  it('keeps a supported audio extension, lowercased', () => {
    expect(tempUploadName('01 Song.FLAC')).toMatch(/^[0-9a-f-]{36}\.flac$/);
  });

  it.each(['cover.jpg', 'notes', 'track.aiff', '../../etc/passwd.mp3x'])(
    'drops the extension of %s',
    (name) => {
      expect(tempUploadName(name)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('isUnreadableAudioError', () => {
  it.each([
    new CouldNotDetermineFileTypeError('Failed to determine audio format'),
    new UnexpectedFileContentError('FLAC', 'Invalid FLAC preamble'),
    Object.assign(new Error('End-Of-Stream'), { name: 'EndOfStreamError' }),
  ])('treats %s as unreadable content', (error) => {
    expect(isUnreadableAudioError(error)).toBe(true);
  });

  it('leaves I/O errors to the server', () => {
    const error = Object.assign(new Error('EMFILE: too many open files'), {
      code: 'EMFILE',
    });
    expect(isUnreadableAudioError(error)).toBe(false);
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
    [{ date: undefined, year: undefined }, 'Missing date'],
  ])('rejects when %o is invalid', (common, message) => {
    expect(() => extractRequiredTags(buildMetadata(common))).toThrow(message);
  });

  it('uses the year when there is no date, as in ID3v2.3 tags', () => {
    const tags = extractRequiredTags(
      buildMetadata({ date: undefined, year: 2016 }),
    );
    expect(tags.date).toEqual(new Date('2016'));
  });

  it.each(['20160501', '2016-00-00'])(
    'falls back to the year when the date %s does not parse',
    (date) => {
      const tags = extractRequiredTags(buildMetadata({ date, year: 2016 }));
      expect(tags.date).toEqual(new Date('2016'));
    },
  );

  it('allows a missing bit depth', () => {
    const tags = extractRequiredTags(
      buildMetadata({}, { bitsPerSample: undefined }),
    );
    expect(tags.bitDepth).toBeNull();
  });

  it('drops the bit depth of lossy audio, such as AAC in MP4', () => {
    const tags = extractRequiredTags(
      buildMetadata({}, { lossless: false, bitsPerSample: 16 }),
    );
    expect(tags.bitDepth).toBeNull();
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
