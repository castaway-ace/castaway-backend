import {
    Controller,
    Post,
    Get,
    Param,
    UploadedFile,
    UseInterceptors,
    Res,
    HttpStatus,
    Logger,
    BadRequestException,
    Headers
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { type Response } from 'express';
  import { StorageService } from './storage.service';
  
  @Controller('storage')
  export class StorageController {
    private readonly logger = new Logger(StorageController.name);

    private readonly ALLOWED_MIME_TYPES = [
      'audio/mpeg',        // MP3
      'audio/mp3',         // MP3 (alternative)
      'audio/flac',        // FLAC
      'audio/x-flac',      // FLAC (alternative)
      'audio/wav',         // WAV
      'audio/x-wav',       // WAV (alternative)
      'audio/ogg',         // OGG
      'audio/aac',         // AAC
      'audio/mp4',         // M4A
      'audio/x-m4a',       // M4A (alternative)
    ];

    private readonly MAX_FILE_SIZE = 50 * 1024 * 1024;
  
    constructor(private readonly storageService: StorageService) {}
  
    /**
     * Test endpoint to upload a file
     * POST /storage/upload
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'No file provided',
        };
      }

      // Validate file type
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
        );
      }

      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
        );
      }
  
      try {
        const result = await this.storageService.uploadFile(
          file.originalname,
          file.buffer,
          file.mimetype,
          {
            originalName: file.originalname,
            uploadedAt: new Date().toISOString(),
          },
        );
  
        return {
          statusCode: HttpStatus.OK,
          message: 'File uploaded successfully',
          data: result,
        };
      } catch (error) {
        this.logger.error(`Upload failed: ${error.message}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Upload failed',
          error: error.message,
        };
      }
    }
  
    /**
     * Test endpoint to download a file
     * GET /storage/download/:filename
     */
    @Get('stream/:filename')
    async streamFile(@Param('filename') filename: string, @Headers('range') range: string, @Res() res: Response) {
      try {
        // Check if file exists
        const exists = await this.storageService.fileExists(filename);
        
        if (!exists) {
          return res.status(HttpStatus.NOT_FOUND).json({
            message: 'File not found',
          });
        }
  
        // Get file stats for content type and size
        const stats = await this.storageService.getFileStats(filename);

        // Set content type (critical for audio playback)
        res.setHeader('Content-Type', stats.metaData['content-type'] || 'audio/mpeg');
        
        // Enable caching for better performance
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Accept-Ranges', 'bytes');

        // Handle range requests (for seeking in audio player)
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
          const chunkSize = end - start + 1;

          // Set partial content headers
          res.status(HttpStatus.PARTIAL_CONTENT);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
          res.setHeader('Content-Length', chunkSize);
          
          this.logger.log(`Streaming ${filename} [${start}-${end}/${stats.size}]`);
        } else {
          // Full file request
          res.setHeader('Content-Length', stats.size);
          res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
          
          this.logger.log(`Streaming ${filename} [full file: ${stats.size} bytes]`);
        }
        
        // Get file stream
        const fileStream = await this.storageService.getFile(filename);
  
        // Pipe the stream to response
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${filename}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });

      } catch (error) {
        this.logger.error(`Download failed: ${error.message}`);
        if (!res.headersSent) {
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: 'Streaming failed',
            error: error.message,
          });
        }
      }
    }
  
    /**
     * Test endpoint to list all files
     * GET /storage/files
     */
    @Get('files')
    async listFiles() {
      try {
        const files = await this.storageService.listFiles();
        
        return {
          statusCode: HttpStatus.OK,
          message: 'Files retrieved successfully',
          data: files,
        };
      } catch (error) {
        this.logger.error(`List files failed: ${error.message}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to list files',
          error: error.message,
        };
      }
    }
  }