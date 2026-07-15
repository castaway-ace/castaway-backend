import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToInt } from '../../common/dto/dto-transforms.js';

/**
 * Paginates the library.
 *
 * @remarks
 * Deliberately offers no sort options: the library has exactly one meaningful
 * order (recency, then alphabetical), and it's computed after the three entity
 * types are merged rather than by the database.
 */
export class LibraryQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @ToInt()
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ToInt()
  offset?: number;
}
