import { IPicture } from 'music-metadata';

export interface MetadataTags {
  title: string;
  albumTitle: string;
  albumArtistNames: string[];
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

export interface ParsedFile {
  file: Express.Multer.File;
  tags: MetadataTags;
  suffix: string;
}
