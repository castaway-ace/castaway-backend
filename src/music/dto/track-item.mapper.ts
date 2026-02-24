import { TrackItemWithRelations } from '../music.types.js';
import { TrackItemDto } from './track-item.dto.js';

export const toTrackItemDto = (
  track: TrackItemWithRelations,
): TrackItemDto => ({
  id: track.id,
  title: track.title,
  duration: track.duration || 0,
  album: {
    id: track.album.id,
    title: track.album.title,
  },
  artists: track.artists.map((a) => ({
    id: a.artist.id,
    name: a.artist.name,
  })),
});
