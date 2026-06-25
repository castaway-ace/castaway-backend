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
import { ToBoolean, ToInt } from '../utils/dto-transforms.js';
import { ApiProperty } from '@nestjs/swagger';

export interface ArtistOrderOptions {
  order: 'name';
  orderBy: 'asc' | 'desc';
}

export class ArtistQueryDto {
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  starred?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['name'])
  order?: ArtistOrderOptions['order'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: ArtistOrderOptions['orderBy'];

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

export class CreateArtistDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
