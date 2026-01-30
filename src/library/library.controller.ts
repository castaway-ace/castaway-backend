import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../user/user.decorator.js';
import { LibraryService } from './library.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  /**
   * Add track to library
   * POST /library/tracks/:id
   */
  @Post('/tracks/:id')
  async addToLibrary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.libraryService.addToLibrary(user.userId, id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Remove track from library
   * DELETE /library/tracks/:id
   */
  @Delete('/tracks/:id')
  async removeFromLibrary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.libraryService.removeFromLibrary(user.userId, id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Get all tracks in library
   * GET /library/tracks?limit=50&offset=0
   */
  @Get('/tracks')
  async getLibraryTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tracks = await this.libraryService.getLibraryTracks(user.userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return {
      statusCode: HttpStatus.OK,
      data: tracks,
    };
  }

  /**
   * Get distinct artists from library
   * GET /library/artists
   */
  @Get('/artists')
  async getLibraryArtists(@CurrentUser() user: AuthenticatedUser) {
    const artists = await this.libraryService.getLibraryArtists(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: artists,
    };
  }

  /**
   * Get distinct albums from library
   * GET /library/albums
   */
  @Get('/albums')
  async getLibraryAlbums(@CurrentUser() user: AuthenticatedUser) {
    const albums = await this.libraryService.getLibraryAlbums(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: albums,
    };
  }
}
