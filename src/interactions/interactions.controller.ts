import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InteractionsService } from './interactions.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { Interaction } from './interactions.types.js';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ArtistInteractionEntity,
  PlaylistInteractionEntity,
  AlbumInteractionEntity,
} from './interactions.entity.js';
import { InteractionQueryDto } from './dto/interaction-query.dto.js';

@Controller('interactions')
@ApiExtraModels(
  ArtistInteractionEntity,
  PlaylistInteractionEntity,
  AlbumInteractionEntity,
)
@ApiBearerAuth()
@ApiTags('Interactions')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(ArtistInteractionEntity) },
          { $ref: getSchemaPath(PlaylistInteractionEntity) },
          { $ref: getSchemaPath(AlbumInteractionEntity) },
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            artist: getSchemaPath(ArtistInteractionEntity),
            playlist: getSchemaPath(PlaylistInteractionEntity),
            album: getSchemaPath(AlbumInteractionEntity),
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async findAll(
    @CurrentUser('sub') sub: string,
    @Query() query: InteractionQueryDto,
  ): Promise<Interaction[]> {
    return this.interactionsService.findAll(sub, query.limit);
  }

  @Post('/albums/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async createOrUpdateAlbum(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdateAlbum(sub, id);
  }

  @Post('/artists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async createOrUpdateArtist(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdateArtist(sub, id);
  }

  @Post('/playlists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Playlist not found.' })
  async createOrUpdatePlaylist(
    @CurrentUser('sub') sub: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.interactionsService.createOrUpdatePlaylist(sub, id);
  }
}
