import {
  Controller,
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
import { type Express } from 'express';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('upload/track')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrack(@UploadedFile() file: Express.Multer.File): Promise<void> {
    await this.adminService.uploadTrack(file);
  }

  @Post('upload/album')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<void> {
    await this.adminService.uploadAlbum(files);
  }
}
