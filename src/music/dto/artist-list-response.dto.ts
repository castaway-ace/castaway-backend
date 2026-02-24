import { ArtistItemDto } from './artist-item.dto.js';
import { PaginationMeta } from './track-list-response.dto.js';

export interface ArtistListResponseDto {
  data: ArtistItemDto[];
  meta: PaginationMeta;
}
