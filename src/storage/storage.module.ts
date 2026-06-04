import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service.js';

@Module({
  providers: [ConfigService, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
