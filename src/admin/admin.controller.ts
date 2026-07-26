import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/rbac/permissions.js';
import { AdminService } from './admin.service.js';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateArtistDto } from '../artists/dto/create-artist.dto.js';
import { ArtistRef } from '../common/entities/references.entity.js';

@Controller('admin')
@ApiBearerAuth()
@ApiTags('Admin')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({ description: 'Insufficient permissions.' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('artists')
  @RequirePermissions(Permission.CatalogWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ArtistRef })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  @ApiConflictResponse({ description: 'Artist with this name already exists.' })
  uploadArtist(
    @Body() artistDto: CreateArtistDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ArtistRef> {
    return this.adminService.uploadArtist(artistDto.name, file);
  }

  @Post('artists/:id/image')
  @RequirePermissions(Permission.CatalogWrite)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async uploadArtistImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<void> {
    await this.adminService.uploadArtistImage(id, file);
  }

  @Delete('artists/:id')
  @RequirePermissions(Permission.CatalogDelete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async deleteArtist(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.adminService.deleteArtist(id);
  }

  @Delete('albums/:id')
  @RequirePermissions(Permission.CatalogDelete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async deleteAlbum(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.adminService.deleteAlbum(id);
  }
}
