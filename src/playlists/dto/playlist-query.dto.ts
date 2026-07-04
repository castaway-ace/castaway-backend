import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToBoolean, ToInt } from '../../common/dto/dto-transforms.js';
import { SORT_DIRECTIONS, type SortDirection } from '../../common/dto/sort.js';

export const PLAYLIST_SORT_ORDERS = ['name', 'added'] as const;
export type PlaylistSortOrder = (typeof PLAYLIST_SORT_ORDERS)[number];

export interface PlaylistOrderOptions {
  order: PlaylistSortOrder;
  orderBy: SortDirection;
}

export class PlaylistQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  onlyUser?: boolean;

  @ApiPropertyOptional({
    enum: PLAYLIST_SORT_ORDERS,
    enumName: 'PlaylistSortOrder',
  })
  @IsOptional()
  @IsIn(PLAYLIST_SORT_ORDERS)
  order?: PlaylistSortOrder;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, enumName: 'SortDirection' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  orderBy?: SortDirection;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @ToInt()
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ToInt()
  offset?: number;
}
