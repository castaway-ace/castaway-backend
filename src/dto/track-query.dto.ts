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

export interface TrackSortOptions {
  sort: 'title' | 'album' | 'year' | 'added';
  sortBy: 'asc' | 'desc';
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
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @IsOptional()
  @IsIn(['title', 'album', 'year', 'added'])
  sort?: TrackSortOptions['sort'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortBy?: TrackSortOptions['sortBy'];

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
