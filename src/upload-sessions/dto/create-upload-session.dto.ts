import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { mimeToSuffix } from '../../common/constants.js';

const SUPPORTED_CONTENT_TYPES = Object.keys(mimeToSuffix);

// 2 GiB - 1: the largest value that fits Postgres INT4, matching Track.size.
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 - 1;

export class UploadFileDescriptorDto {
  @ApiProperty({ maxLength: 255, description: 'Original file name.' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_FILE_SIZE_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  size!: number;

  @ApiProperty({ enum: SUPPORTED_CONTENT_TYPES })
  @IsIn(SUPPORTED_CONTENT_TYPES)
  contentType!: string;
}

export class CreateUploadSessionDto {
  @ApiProperty({ type: [UploadFileDescriptorDto], minItems: 1, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UploadFileDescriptorDto)
  files!: UploadFileDescriptorDto[];
}
