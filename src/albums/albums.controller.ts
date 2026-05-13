import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AlbumsService } from './albums.service.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { AlbumQueryDto } from '../dto/album-query.dto.js';
import { Album } from '../../generated/prisma/client.js';

@Controller('albums')
@UseGuards(AuthGuard)
export class AlbumsController {
  constructor(private readonly albumService: AlbumsService) {}

  @Get()
  async getTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AlbumQueryDto,
  ): Promise<Album[]> {
    return this.albumService.findAlbums(user.sub, {
      filters: {
        artistIds: query.artistIds,
        genres: query.genres,
        starred: query.starred,
      },
      sort: query.sort
        ? { sort: query.sort, sortBy: query.sortBy ?? 'asc' }
        : undefined,
      pagination: { limit: query.limit, offset: query.offset },
    });
  }
}
