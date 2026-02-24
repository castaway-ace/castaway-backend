import { TrackItemDto } from './track-item.dto.js';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrackListResponseDto {
  data: TrackItemDto[];
  meta: PaginationMeta;
}
