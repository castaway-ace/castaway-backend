import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchResultsEntity } from './search.entity.js';

@Controller('search')
@ApiBearerAuth()
@ApiTags('Search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOkResponse({ type: SearchResultsEntity })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  find(
    @CurrentUser('sub') sub: string,
    @Query() dto: SearchQueryDto,
  ): Promise<SearchResultsEntity> {
    return this.searchService.find(sub, dto.query);
  }
}
