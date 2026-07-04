import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ArtistsService } from './artists.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ArtistEntity, ArtistSummaryEntity } from './artists.entity.js';
import { ArtistQueryDto } from './dto/artist-query.dto.js';

@Controller('artists')
@ApiBearerAuth()
@ApiTags('Artists')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class ArtistsController {
  constructor(private readonly artistService: ArtistsService) {}

  @Get()
  @ApiOkResponse({ type: ArtistSummaryEntity, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: ArtistQueryDto,
  ): Promise<ArtistSummaryEntity[]> {
    return this.artistService.findAll(sub, {
      filters: {
        starred: query.starred,
        search: query.search,
      },
      sortOptions:
        query.order || query.orderBy
          ? { order: query.order ?? 'name', orderBy: query.orderBy ?? 'asc' }
          : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: ArtistEntity })
  @ApiBadRequestResponse({ description: 'Invalid artist id.' })
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ArtistEntity> {
    const artist = await this.artistService.find(sub, id);

    return artist;
  }

  @Get(':id/image')
  @ApiOkResponse({
    schema: {
      type: 'string',
      description: 'Presigned URL to the artist image.',
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid artist id.' })
  @ApiNotFoundResponse({ description: 'Artist image not found.' })
  async getArtistImageUrl(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<string> {
    const url = await this.artistService.getArtistImageUrl(id);

    return url;
  }

  @Post(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid artist id.' })
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.artistService.star(sub, id);
  }

  @Delete(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid artist id.' })
  async unstar(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.artistService.unstar(sub, id);
  }
}
