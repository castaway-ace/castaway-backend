import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ToBoolean, ToInt, ToStringArray } from '../utils/dto-transforms.js';

export interface AlbumSortOptions {
  sort: 'title' | 'year' | 'added';
  sortBy: 'asc' | 'desc';
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
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @IsOptional()
  @IsIn(['title', 'year', 'added'])
  sort?: AlbumSortOptions['sort'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortBy?: AlbumSortOptions['sortBy'];

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
