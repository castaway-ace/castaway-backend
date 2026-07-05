import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { PrismaModule } from '../prisma/prisma.module.js';

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
            filename: (_req, file, cb) => {
              const ext = extname(file.originalname);
              cb(null, `${randomUUID()}${ext}`);
            },
          }),
        };
      },
    }),
    TracksModule,
    AlbumsModule,
    ArtistsModule,
    PrismaModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
