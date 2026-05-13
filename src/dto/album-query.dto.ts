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
import { ToBoolean, ToInt, ToStringArray } from '../utils/dto-transforms.js';

export interface AlbumSortOptions {
  order: 'title' | 'year' | 'added';
  orderBy: 'asc' | 'desc';
}

export class AlbumQueryDto {
  @IsOptional()
  @IsString({ each: true })
  @ToStringArray()
  artistIds?: string[];

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
  @IsIn(['title', 'year', 'added'])
  order?: AlbumSortOptions['order'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: AlbumSortOptions['orderBy'];

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
