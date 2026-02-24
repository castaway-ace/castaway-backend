import { TrackWithRelations } from '../music.types.js';
import { TrackDetailDto } from './track-detail.dto.js';

export function toTrackDetailDto(track: TrackWithRelations): TrackDetailDto {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration || 0,
    trackNumber: track.trackNumber ?? null,
    discNumber: track.discNumber ?? null,
    album: {
      id: track.album.id,
      title: track.album.title,
    },
    artists: track.artists.map((a) => ({
      id: a.artist.id,
      name: a.artist.name,
    })),
  };
}
