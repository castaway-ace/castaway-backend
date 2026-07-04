import {
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToBoolean, ToInt } from '../../common/dto/dto-transforms.js';
import { SORT_DIRECTIONS, type SortDirection } from '../../common/dto/sort.js';

export const ARTIST_SORT_ORDERS = ['name'] as const;
export type ArtistSortOrder = (typeof ARTIST_SORT_ORDERS)[number];

export interface ArtistOrderOptions {
  order: ArtistSortOrder;
  orderBy: SortDirection;
}

export class ArtistQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ARTIST_SORT_ORDERS,
    enumName: 'ArtistSortOrder',
  })
  @IsOptional()
  @IsIn(ARTIST_SORT_ORDERS)
  order?: ArtistSortOrder;

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
