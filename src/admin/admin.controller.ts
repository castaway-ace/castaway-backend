import {
  Body,
  Controller,
  Delete,
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
import { CreateArtistDto } from '../artists/dto/artist-query.dto.js';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('upload/artist')
  async uploadArtist(@Body() artistDto: CreateArtistDto): Promise<void> {
    await this.adminService.uploadArtist(artistDto.name);
  }

  @Post('upload/artist-art/:id')
  @UseInterceptors(FileInterceptor('file'))
  async uploadArtistArt(
    @UploadedFile() file: Express.Multer.File,
    @Param('id') id: string,
  ): Promise<void> {
    await this.adminService.uploadArtistArt(id, file);
  }

  @Delete('delete/artist/:id')
  async deleteArtist(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteArtist(id);
  }

  @Post('upload/album')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    await this.adminService.uploadAlbum(files);
  }

  @Delete('delete/album/:id')
  async deleteAlbum(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteAlbum(id);
  }

  @Post('create/referral-code')
  async createReferralCode(@CurrentUser('sub') sub: string): Promise<void> {
    await this.adminService.createReferralCode(sub);
  }
}
