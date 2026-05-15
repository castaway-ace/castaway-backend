import { Injectable } from '@nestjs/common';
import { StorageBucket, StorageService } from '../storage/storage.service.js';
import 'multer';

@Injectable()
export class AdminService {
  constructor(private readonly storageService: StorageService) {}

  async uploadTrack(file: Express.Multer.File): Promise<void> {
    await this.storageService.putObject(
      StorageBucket.Tracks,
      '123',
      file.buffer,
      {
        contentType: file.mimetype,
        size: file.size,
        metadata: {
          originalName: file.originalname,
        },
      },
    );
    console.log(file);
  }

  async uploadAlbum(files: Express.Multer.File[]): Promise<void> {
    await Promise.all(files.map((file) => this.uploadTrack(file)));
  }
}
