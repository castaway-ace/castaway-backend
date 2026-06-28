import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { SearchResults, SearchService } from './search.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { SearchQueryDto } from './dto/search-query.dto.js';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async find(
    @CurrentUser('sub') sub: string,
    @Query() dto: SearchQueryDto,
  ): Promise<SearchResults> {
    return this.searchService.find(sub, dto.query);
  }
}
