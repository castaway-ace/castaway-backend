import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { ArtistsService } from './artists.service.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { ArtistQueryDto } from '../dto/artist-query.dto.js';
import { Artist } from '../../generated/prisma/client.js';

@Controller('artists')
@UseGuards(AuthGuard)
export class ArtistsController {
  constructor(private readonly artistService: ArtistsService) {}

  @Get()
  async getArtists(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ArtistQueryDto,
  ): Promise<Artist[]> {
    return this.artistService.findArtists(user.sub, {
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
  async getArtist(@Param('id') id: string): Promise<Artist> {
    const artist = await this.artistService.findArtist(id);

    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    return artist;
  }

  @Get(':id/stream')
  async getArtistStream(@Param('id') id: string): Promise<StreamableFile> {
    const artistStream = await this.artistService.findArtistStream(id);

    return new StreamableFile(artistStream);
  }

  @Post(':id/star')
  @HttpCode(204)
  async starArtist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.artistService.updateArtistStar(id, user.sub, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStarArtist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.artistService.updateArtistStar(id, user.sub, false);
  }
}
