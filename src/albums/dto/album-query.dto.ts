import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  IsUUID,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ToStringArray,
  ToBoolean,
  ToInt,
} from '../../common/dto/dto-transforms.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SORT_DIRECTIONS, type SortDirection } from '../../common/dto/sort.js';

export const ALBUM_SORT_ORDERS = ['title', 'year', 'added'] as const;

export type AlbumSortOrder = (typeof ALBUM_SORT_ORDERS)[number];

export interface AlbumSortOptions {
  order: AlbumSortOrder;
  orderBy: SortDirection;
}

export class AlbumQueryDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { each: true })
  @ToStringArray()
  artistIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsString({ each: true })
  @ToStringArray()
  genres?: string[];

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @ApiPropertyOptional({ enum: ALBUM_SORT_ORDERS, enumName: 'AlbumSortOrder' })
  @IsOptional()
  @IsIn(ALBUM_SORT_ORDERS)
  order?: AlbumSortOrder;

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
