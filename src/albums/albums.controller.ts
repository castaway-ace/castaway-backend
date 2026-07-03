import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { AlbumsService } from './albums.service.js';
import { AlbumEntity, AlbumSummaryEntity } from './albums.entity.js';
import { AlbumQueryDto } from './dto/album-query.dto.js';

@Controller('albums')
@ApiBearerAuth()
@ApiTags('Albums')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class AlbumsController {
  constructor(private readonly albumService: AlbumsService) {}

  @Get()
  @ApiOkResponse({ type: AlbumSummaryEntity, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: AlbumQueryDto,
  ): Promise<AlbumSummaryEntity[]> {
    return this.albumService.findAll(sub, {
      filters: {
        artistIds: query.artistIds,
        genres: query.genres,
        starred: query.starred,
        search: query.search,
      },
      sortOptions:
        query.order || query.orderBy
          ? { order: query.order ?? 'title', orderBy: query.orderBy ?? 'asc' }
          : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: AlbumEntity })
  @ApiNotFoundResponse({ description: 'Album not found.' })
  find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<AlbumEntity> {
    return this.albumService.find(sub, id);
  }

  @Get(':id/cover')
  @ApiOkResponse({
    schema: {
      type: 'string',
      description: 'Presigned URL to the cover image.',
    },
  })
  @ApiNotFoundResponse({ description: 'Album cover not found.' })
  getAlbumCoverUrl(@Param('id') id: string): Promise<string> {
    return this.albumService.getAlbumCoverUrl(id);
  }

  @Post(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.albumService.star(sub, id);
  }

  @Delete(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async unstar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.albumService.unstar(sub, id);
  }
}
