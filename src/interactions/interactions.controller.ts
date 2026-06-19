import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { InteractionsService } from './interactions.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { Interaction } from '../types/interactions.js';

@Controller('interactions')
@UseGuards(AuthGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get()
  async findAll(@CurrentUser('sub') sub: string): Promise<Interaction[]> {
    return this.interactionsService.findAll(sub);
  }

  @Post('/albums/:id')
  @HttpCode(204)
  async createOrUpdateAlbum(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdateAlbum(sub, id);
  }

  @Post('/artists/:id')
  @HttpCode(204)
  async createOrUpdateArtist(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdateArtist(sub, id);
  }

  @Post('/playlists/:id')
  @HttpCode(204)
  async createOrUpdatePlaylist(
    @CurrentUser('sub') sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdatePlaylist(sub, id);
  }
}
