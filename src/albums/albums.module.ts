import { Module } from '@nestjs/common';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';

@Module({
  providers: [AlbumsService],
  controllers: [AlbumsController],
})
export class AlbumsModule {}
