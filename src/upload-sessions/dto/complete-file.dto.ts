import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompletedPartDto {
  @ApiPropertyOptional({ minimum: 1, description: '1-based part number.' })
  @IsInt()
  @Min(1)
  partNumber!: number;

  @ApiPropertyOptional({ description: 'ETag returned by the part upload.' })
  @IsString()
  @IsNotEmpty()
  etag!: string;
}

export class CompleteFileDto {
  @ApiPropertyOptional({
    type: [CompletedPartDto],
    description:
      'Uploaded parts for a multipart file. Omit for single-PUT files.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts?: CompletedPartDto[];
}
