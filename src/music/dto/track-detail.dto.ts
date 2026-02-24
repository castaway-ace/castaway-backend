import { ArtistDto, TrackAlbumDto } from './track-item.dto.js';

export interface TrackDetailDto {
  id: string;
  title: string;
  duration: number;
  trackNumber: number | null;
  discNumber: number | null;
  album: TrackAlbumDto;
  artists: ArtistDto[];
}
