import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ToBoolean, ToInt } from '../utils/dto-transforms.js';
import { ApiProperty } from '@nestjs/swagger';

export interface PlaylistOrderOptions {
  order: 'name' | 'added';
  orderBy: 'asc' | 'desc';
}

export class PlaylistQueryDto {
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  onlyUser?: boolean;

  @IsOptional()
  @IsIn(['name', 'added'])
  order?: PlaylistOrderOptions['order'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: PlaylistOrderOptions['orderBy'];

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

export class PlaylistDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  readonly name!: string;
}
