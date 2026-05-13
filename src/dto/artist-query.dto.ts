import { IsOptional, IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';
import { ToBoolean, ToInt } from '../utils/dto-transforms.js';

export interface ArtistSortOptions {
  sort: 'name';
  sortBy: 'asc' | 'desc';
}

export class ArtistQueryDto {
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @IsOptional()
  @IsIn(['name'])
  sort?: ArtistSortOptions['sort'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortBy?: ArtistSortOptions['sortBy'];

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
