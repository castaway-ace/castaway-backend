import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
