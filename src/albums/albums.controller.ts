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
import { Album, AlbumSummary } from '../types/albums.js';

@Controller('albums')
@UseGuards(AuthGuard)
export class AlbumsController {
  constructor(private readonly albumService: AlbumsService) {}

  @Get()
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: AlbumQueryDto,
  ): Promise<AlbumSummary[]> {
    return this.albumService.findAll(sub, {
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
  async find(@Param('id') id: string): Promise<Album> {
    const album = await this.albumService.find(id);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album;
  }

  @Get(':id/stream')
  async findAlbumCover(@Param('id') id: string): Promise<StreamableFile> {
    const { stream, contentType, contentLength } =
      await this.albumService.findAlbumCover(id);

    return new StreamableFile(stream, {
      type: contentType,
      length: contentLength,
    });
  }

  @Post(':id/star')
  @HttpCode(204)
  async star(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.albumService.updateStar(sub, id, true);
  }

  @Delete(':id/star')
  @HttpCode(204)
  async unStar(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.albumService.updateStar(sub, id, false);
  }
}
