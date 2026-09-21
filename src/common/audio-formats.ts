/**
 * Content type for each audio format a track can be stored as, keyed by the
 * suffix used in the track's storage key and `suffix` column.
 */
export const AUDIO_CONTENT_TYPES = {
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
} as const;

export type AudioSuffix = keyof typeof AUDIO_CONTENT_TYPES;

export interface AudioFormat {
  suffix: AudioSuffix;
  contentType: string;
}

export function isAudioSuffix(value: string): value is AudioSuffix {
  return Object.hasOwn(AUDIO_CONTENT_TYPES, value);
}
