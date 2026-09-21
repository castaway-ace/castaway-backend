import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { tempUploadName } from './metadata.js';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const destination = configService.get<string>('UPLOAD_TMP_DIR');
        if (!destination) {
          throw new Error('UPLOAD_TMP_DIR environment variable must be set');
        }
        return {
          storage: diskStorage({
            destination,
            filename: (_req, file, cb) =>
              cb(null, tempUploadName(file.originalname)),
          }),
          // Clients send filenames as UTF-8; the default, latin1, garbles them.
          defParamCharset: 'utf8',
        };
      },
    }),
    TracksModule,
    AlbumsModule,
    ArtistsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
