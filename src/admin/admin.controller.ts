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
import { AuthService } from '../auth/auth.service.js';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly musicService: MusicService,
    private readonly authService: AuthService,
  ) {}

  // ==================== AUTH ====================

  @Get('login')
  @Render('admin/login')
  loginPage(): Record<string, boolean> {
    return { showNav: false };
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.validateAdminCredentials(
      body.email,
      body.password,
    );

    if (!user) {
      return res.render('admin/login', { error: 'Invalid credentials' });
    }

    req.session.admin = true;
    return res.redirect('/admin');
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

    return {
      albums,
      albumCount,
      tracks,
      trackCount,
      artists,
      artistCount,
      showNav: true,
    };
  }

  // ==================== UPLOADS ====================

  @Get('upload/track')
  @UseGuards(AdminGuard)
  @Render('admin/upload-track')
  uploadTrackPage(): Record<string, boolean> {
    return { showNav: true };
  }

  @Post('upload/track')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('track'))
  async uploadTrack(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.musicService.uploadTrack(file);
      return res.render('admin/upload-track', {
        success: result.message,
        trackId: result.trackId,
        showNav: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return res.render('admin/upload-track', {
        error: message,
        showNav: true,
      });
    }
  }

  @Get('upload/album')
  @UseGuards(AdminGuard)
  @Render('admin/upload-album')
  uploadAlbumPage(): Record<string, boolean> {
    return { showNav: true };
  }

  @Post('upload/album')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FilesInterceptor('album', 100, {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB per file
      },
    }),
  )
  async uploadAlbum(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.musicService.uploadAlbum(files);
      return res.render('admin/upload-album', { result, showNav: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      return res.render('admin/upload-album', {
        error: message,
        showNav: true,
      });
    }
  }
}
