import { Module } from '@nestjs/common';
import { AlbumsService } from './albums.service.js';
import { AlbumsController } from './albums.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { GuardModule } from '../auth/guard.module.js';

@Module({
  imports: [StorageModule, GuardModule],
  providers: [AlbumsService],
  controllers: [AlbumsController],
  exports: [AlbumsService],
})
export class AlbumsModule {}
