import { Module } from '@nestjs/common';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [StorageModule, GuardModule],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
