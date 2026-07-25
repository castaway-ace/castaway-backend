import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { ArtistRef } from '../common/entities/references.entity.js';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  async uploadArtist(
    name: string,
    file?: Express.Multer.File,
  ): Promise<ArtistRef> {
    try {
      if (file && !file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Artist art must be an image');
      }
      const artist = await this.artistService.create({
        id: randomUUID(),
        name,
      });

      if (file) {
        try {
          await this.artistService.uploadImage(artist.id, file);
        } catch (error) {
          await this.artistService
            .delete(artist.id)
            .catch((cleanupError: unknown) =>
              this.logger.warn(
                `Failed to roll back artist ${artist.id} after image upload failure: ${
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError)
                }`,
              ),
            );
          throw error;
        }
      }

      return artist;
    } finally {
      if (file) {
        await this.cleanupFile(file);
      }
    }
  }

  async deleteArtist(id: string): Promise<void> {
    await this.artistService.delete(id);
  }

  async deleteAlbum(id: string): Promise<void> {
    await this.trackService.deleteAlbumTrackFiles(id);
    await this.albumService.delete(id);
  }

  async uploadArtistImage(
    artistId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Artist art must be an image');
      }

      await this.artistService.uploadImage(artistId, file);
    } finally {
      await this.cleanupFile(file);
    }
  }

  private async cleanupFile(file: Express.Multer.File): Promise<void> {
    if (!file.path) return;
    try {
      await unlink(file.path);
    } catch (error) {
      this.logger.warn(
        `Failed to clean up upload file ${file.path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
