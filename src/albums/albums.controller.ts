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
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { AlbumQueryDto } from '../dto/album.dto.js';
import { Album, Albums } from '../types/albums.js';

@Controller('albums')
@UseGuards(AuthGuard)
export class AlbumsController {
  constructor(private readonly albumService: AlbumsService) {}

  @Get()
  async getTracks(
    @CurrentUser('sub') sub: string,
    @Query() query: AlbumQueryDto,
  ): Promise<Albums> {
    return this.albumService.findAlbums(sub, {
      filters: {
        artistIds: query.artistIds,
        genres: query.genres,
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
  async getAlbum(@Param('id') id: string): Promise<Album> {
    const album = await this.albumService.findAlbum(id);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album;
  }

  @Get(':id/stream')
  async getAlbumStream(@Param('id') id: string): Promise<StreamableFile> {
    const { stream, contentType, contentLength } =
      await this.albumService.findAlbumStream(id);

    return new StreamableFile(stream, {
      type: contentType,
      length: contentLength,
    });
  }

  @Post(':id/star')
  @HttpCode(204)
  async starAlbum(
    @Param('id') id: string,
    @CurrentUser('sub') sub: string,
  ): Promise<void> {
    await this.albumService.updateAlbumStar(id, sub, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStarAlbum(
    @Param('id') id: string,
    @CurrentUser('sub') sub: string,
  ): Promise<void> {
    await this.albumService.updateAlbumStar(id, sub, false);
  }
}
