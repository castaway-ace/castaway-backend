import {
  Controller,
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

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('upload/album')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    await this.adminService.uploadAlbum(files);
  }

  @Post('upload/artist-art/:id')
  @UseInterceptors(FileInterceptor('file'))
  async uploadArtistArt(
    @UploadedFile() file: Express.Multer.File,
    @Param('id') id: string,
  ): Promise<void> {
    await this.adminService.uploadArtistArt(id, file);
  }
}
