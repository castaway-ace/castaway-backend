import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ToInt } from '../../common/dto/dto-transforms.js';
import { LibraryItemType } from '../library.types.js';

/**
 * Narrows and paginates the library.
 *
 * @remarks
 * Deliberately offers no sort options: the library has exactly one meaningful
 * order (recency, then alphabetical), and it's computed after the entity types
 * are merged rather than by the database. `type` is the only filter — it picks
 * which of those types to merge in the first place.
 */
export class LibraryQueryDto {
  /**
   * Restricts the library to a single entity type; omitted returns all three.
   *
   * @remarks
   * {@link LibraryItemType}'s values are already the wire format, so it
   * validates directly with no transform — unlike the numeric params below.
   */
  @ApiPropertyOptional({ enum: LibraryItemType, enumName: 'LibraryItemType' })
  @IsOptional()
  @IsEnum(LibraryItemType)
  type?: LibraryItemType;

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
