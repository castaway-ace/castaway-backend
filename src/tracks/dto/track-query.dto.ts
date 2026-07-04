import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ToBoolean, ToInt, ToStringArray } from '../../common/dto/dto-transforms.js';
import { SortDirection } from 'src/common/dto/sort.js';

export const ARTIST_SORT_ORDERS = ['title', 'album', 'year', 'added'] as const;

export type TrackSortOrder = (typeof ARTIST_SORT_ORDERS)[number];

export interface TrackOrderOptions {
  order: TrackSortOrder;
  orderBy: SortDirection;
}

export class TrackQueryDto {
  @IsOptional()
  @IsString({ each: true })
  @ToStringArray()
  artistIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @ToStringArray()
  albumIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @ToStringArray()
  genres?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @IsOptional()
  @IsIn(['title', 'album', 'year', 'added'])
  order?: TrackOrderOptions['order'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: TrackOrderOptions['orderBy'];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @ToInt()
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ToInt()
  offset?: number;
}
