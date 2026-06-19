import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { ArtistsService } from './artists.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { ArtistQueryDto } from '../dto/artist.dto.js';
import { Artist, ArtistSummary } from '../types/artists.js';

@Controller('artists')
@UseGuards(AuthGuard)
export class ArtistsController {
  constructor(private readonly artistService: ArtistsService) {}

  @Get()
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: ArtistQueryDto,
  ): Promise<ArtistSummary[]> {
    return this.artistService.findAll(sub, {
      filters: {
        starred: query.starred,
        search: query.search,
      },
      orderOptions: query.order
        ? { order: query.order, orderBy: query.orderBy ?? 'asc' }
        : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }

  @Get(':id')
  async find(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<Artist & { starred: boolean }> {
    const artist = await this.artistService.findWithStarred(sub, id);

    return artist;
  }

  @Get(':id/image')
  async findArtistImage(@Param('id') id: string): Promise<string> {
    const url = await this.artistService.findArtistImage(id);

    return url;
  }

  @Post(':id/star')
  @HttpCode(204)
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.artistService.updateStar(sub, id, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.artistService.updateStar(sub, id, false);
  }
}
