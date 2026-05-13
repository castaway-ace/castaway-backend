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

  @Get(':id')
  async getAlbum(@Param('id') id: string): Promise<Album> {
    const album = await this.albumService.findAlbum(id);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album;
  }

  @Get(':id/stream')
  async getAlbumStream(@Param('id') id: string): Promise<StreamableFile> {
    const albumStream = await this.albumService.findAlbumStream(id);

    return new StreamableFile(albumStream);
  }

  @Post(':id/star')
  @HttpCode(204)
  async starAlbum(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.albumService.updateAlbumStar(id, user.sub, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStarAlbum(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.albumService.updateAlbumStar(id, user.sub, false);
  }
}
