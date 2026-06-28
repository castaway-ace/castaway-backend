import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AdminService } from './admin.service.js';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
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
import { ReferralCodeEntity } from '../referral-code/referral-code.entity.js';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
@ApiBearerAuth()
@ApiTags('Admin')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({ description: 'Requires admin privileges.' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('artists')
  @ApiCreatedResponse({ type: ArtistRef })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  @ApiConflictResponse({ description: 'Artist with this name already exists.' })
  uploadArtist(@Body() artistDto: CreateArtistDto): Promise<ArtistRef> {
    return this.adminService.uploadArtist(artistDto.name);
  }

  @Post('artists/:id/image')
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
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<void> {
    await this.adminService.uploadArtistImage(id, file);
  }

  @Delete('artists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Artist not found.' })
  async deleteArtist(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteArtist(id);
  }

  @Post('albums')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Album imported.' })
  @ApiBadRequestResponse({ description: 'Invalid files or metadata.' })
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    await this.adminService.uploadAlbum(files);
  }

  @Delete('albums/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Album not found.' })
  async deleteAlbum(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteAlbum(id);
  }

  @Post('referral-codes')
  @ApiCreatedResponse({ type: ReferralCodeEntity })
  async createReferralCode(
    @CurrentUser('sub') sub: string,
  ): Promise<ReferralCodeEntity> {
    return this.adminService.createReferralCode(sub);
  }
}
