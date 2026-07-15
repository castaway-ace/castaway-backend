import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { LibraryService } from './library.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { LibraryItem } from './library.types.js';
import {
  AlbumLibraryItemEntity,
  ArtistLibraryItemEntity,
  PlaylistLibraryItemEntity,
} from './library.entity.js';
import { LibraryQueryDto } from './dto/library-query.dto.js';

@Controller('library')
@ApiExtraModels(
  ArtistLibraryItemEntity,
  PlaylistLibraryItemEntity,
  AlbumLibraryItemEntity,
)
@ApiBearerAuth()
@ApiTags('Library')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(ArtistLibraryItemEntity) },
          { $ref: getSchemaPath(PlaylistLibraryItemEntity) },
          { $ref: getSchemaPath(AlbumLibraryItemEntity) },
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            artist: getSchemaPath(ArtistLibraryItemEntity),
            playlist: getSchemaPath(PlaylistLibraryItemEntity),
            album: getSchemaPath(AlbumLibraryItemEntity),
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: LibraryQueryDto,
  ): Promise<LibraryItem[]> {
    return this.libraryService.findAll(sub, {
      pagination: { limit: query.limit, offset: query.offset },
      type: query.type,
    });
  }
}
