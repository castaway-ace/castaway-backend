import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { SearchResults, SearchService } from './search.service.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { SearchQueryDto } from '../dto/search.dto.js';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query() dto: SearchQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SearchResults> {
    return this.searchService.search(dto.query, user.sub);
  }
}
