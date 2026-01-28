import {
  Controller,
  Get,
  Param,
  Res,
  HttpStatus,
  Logger,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { type Response } from 'express';
import { StorageService } from './storage.service.js';

@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Stream an audio file with range request support
   * GET /storage/stream/tracks/:storageKey
   * Example: /storage/stream/tracks/abc123.mp3
   */
  @Get('stream/tracks/:storageKey')
  async streamTrack(
    @Param('storageKey') storageKey: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    try {
      const fullStorageKey = `tracks/${storageKey}`;

      // Check if file exists
      const exists = await this.storage.fileExists(fullStorageKey);
      if (!exists) {
        throw new NotFoundException('Track not found');
      }

      // Get file stats for content type and size
      const stats = await this.storage.getFileStats(fullStorageKey);

      // Set content type (critical for audio playback)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const contentType = stats.metaData['content-type'] || 'audio/mpeg';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res.setHeader('Content-Type', contentType);

      // Enable caching for better performance
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');

      // Handle range requests (for seeking in audio player)
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunkSize = end - start + 1;

        // Validate range
        if (start >= stats.size || end >= stats.size) {
          res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
          res.setHeader('Content-Range', `bytes */${stats.size}`);
          return res.end();
        }

        // Set partial content headers
        res.status(HttpStatus.PARTIAL_CONTENT);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', chunkSize);

        this.logger.log(
          `Streaming ${storageKey} [${start}-${end}/${stats.size}]`,
        );

        // Use getFileRange for efficient partial streaming
        const fileStream = await this.storage.getFileRange(
          fullStorageKey,
          start,
          chunkSize,
        );

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      } else {
        // Full file request
        res.setHeader('Content-Length', stats.size);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${storageKey}"`,
        );

        this.logger.log(
          `Streaming ${storageKey} [full file: ${stats.size} bytes]`,
        );

        const fileStream = await this.storage.getFile(fullStorageKey);

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Streaming failed: ${errorMessage}`);
      if (!res.headersSent) {
        if (error instanceof NotFoundException) {
          return res.status(HttpStatus.NOT_FOUND).json({
            message: 'Track not found',
          });
        }
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Streaming failed',
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Stream album art
   * GET /storage/stream/album-art/:storageKey
   * Example: /storage/stream/album-art/abc123.jpg
   */
  @Get('stream/album-art/:storageKey')
  async streamAlbumArt(
    @Param('storageKey') storageKey: string,
    @Res() res: Response,
  ) {
    try {
      const fullStorageKey = `album-art/${storageKey}`;

      // Check if file exists
      const exists = await this.storage.fileExists(fullStorageKey);
      if (!exists) {
        throw new NotFoundException('Album art not found');
      }

      // Get file stats
      const stats = await this.storage.getFileStats(fullStorageKey);

      // Set headers for image
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const contentType = stats.metaData['content-type'] || 'image/jpeg';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      this.logger.log(`Streaming album art: ${storageKey}`);

      const fileStream = await this.storage.getFile(fullStorageKey);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        this.logger.error(
          `Stream error for album art ${storageKey}: ${error.message}`,
        );
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: 'Stream error',
          });
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Album art streaming failed: ${errorMessage}`);
      if (!res.headersSent) {
        if (error instanceof NotFoundException) {
          return res.status(HttpStatus.NOT_FOUND).json({
            message: 'Album art not found',
          });
        }
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Streaming failed',
          error: errorMessage,
        });
      }
    }
  }
}
