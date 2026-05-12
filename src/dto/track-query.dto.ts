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
  field: 'title' | 'album' | 'year' | 'added';
  direction: 'asc' | 'desc';
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
  sortField?: SortOptions['field'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: SortOptions['direction'];

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
