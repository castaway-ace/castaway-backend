import { ArtistWithCounts } from '../music.types.js';
import { ArtistItemDto } from './artist-item.dto.js';

export const toArtistItemDto = (artist: ArtistWithCounts): ArtistItemDto => ({
  id: artist.id,
  name: artist.name,
  albumCount: artist._count.albums,
  trackCount: artist._count.tracks,
});
