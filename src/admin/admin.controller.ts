import {
  Controller,
  Get,
  Post,
  Render,
  Res,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { type Response, type Request } from 'express';
import { MusicService } from '../music/music.service.js';
import { AdminGuard } from './admin.guard.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly musicService: MusicService) {}

  // ==================== AUTH ====================

  @Get('login')
  @Render('admin/login')
  loginPage() {
    return {};
  }

  @Post('login')
  login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    // Simple hardcoded check for now
    // Wire to your AuthService + bcrypt later
    if (
      body.email === process.env.ADMIN_EMAIL &&
      body.password === process.env.ADMIN_PASSWORD
    ) {
      req.session.admin = true;
      return res.redirect('/admin');
    }

    return res.render('admin/login', { error: 'Invalid credentials' });
  }

  @Get('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy(() => {
      res.redirect('/admin/login');
    });
  }

  // ==================== DASHBOARD ====================

  @Get()
  @UseGuards(AdminGuard)
  @Render('admin/dashboard')
  async dashboard() {
    const { albums, total: albumCount } = await this.musicService.getAlbums({
      limit: 10,
      offset: 0,
    });
    const { tracks, total: trackCount } = await this.musicService.getTracks({
      limit: 10,
      offset: 0,
    });
    const { artists, total: artistCount } = await this.musicService.getArtists({
      limit: 10,
      offset: 0,
    });

    return { albums, albumCount, tracks, trackCount, artists, artistCount };
  }

  // ==================== UPLOADS ====================

  @Get('upload/track')
  @UseGuards(AdminGuard)
  @Render('admin/upload-track')
  uploadTrackPage() {
    return {};
  }

  @Post('upload/track')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('track'))
  async uploadTrack(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    try {
      const result = await this.musicService.uploadTrack(file);
      return res.render('admin/upload-track', {
        success: result.message,
        trackId: result.trackId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return res.render('admin/upload-track', { error: message });
    }
  }

  @Get('upload/album')
  @UseGuards(AdminGuard)
  @Render('admin/upload-album')
  uploadAlbumPage() {
    return {};
  }

  @Post('upload/album')
  @UseGuards(AdminGuard)
  @UseInterceptors(FilesInterceptor('tracks', 50))
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    try {
      const result = await this.musicService.uploadAlbum(files);
      return res.render('admin/upload-album', { result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return res.render('admin/upload-album', { error: message });
    }
  }
}
