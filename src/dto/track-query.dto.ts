import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export interface SortOptions {
  sort: 'title' | 'album' | 'year' | 'added';
  sortBy: 'asc' | 'desc';
}

export class TrackQueryDto {
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }): string[] => {
    return Array.isArray(value) ? value : [value];
  })
  artistIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }): string[] => {
    return Array.isArray(value) ? value : [value];
  })
  albumIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }): string[] => {
    return Array.isArray(value) ? value : [value];
  })
  genres?: string[];

  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  @IsOptional()
  @IsIn(['title', 'album', 'year', 'added'])
  sort?: SortOptions['sort'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortBy?: SortOptions['sortBy'];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
