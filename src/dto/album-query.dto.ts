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

export interface AlbumSortOptions {
  sort: 'title' | 'year' | 'added';
  sortBy: 'asc' | 'desc';
}

export class AlbumQueryDto {
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
  genres?: string[];

  @IsOptional()
  @IsBoolean()
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
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
