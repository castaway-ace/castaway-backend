import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  query!: string;
}
