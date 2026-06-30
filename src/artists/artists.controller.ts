import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
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
@UseGuards(AuthGuard)
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
      sortOptions: query.order
        ? { order: query.order, orderBy: query.orderBy ?? 'asc' }
        : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get(':id')
  @ApiOkResponse({ type: ArtistEntity })
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
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
  async getArtistImageUrl(@Param('id') id: string): Promise<string> {
    const url = await this.artistService.getArtistImageUrl(id);

    return url;
  }

  @Post(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.artistService.updateStar(sub, id, true);
  }

  @Delete(':id/star')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async unStar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.artistService.updateStar(sub, id, false);
  }
}
