import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service.js';
import { StorageConfig } from 'src/config/config.types.js';

@Module({
  providers: [
    {
      provide: 'MINIO_CLIENT',
      useFactory: (config: ConfigService) => {
        const storageConfig = config.get<StorageConfig>('storage');

        if (!storageConfig) {
          throw new Error('Storage configuration not found');
        }

        return new Client({
          endPoint: storageConfig.endpoint,
          port: storageConfig.port,
          useSSL: storageConfig.useSSL,
          accessKey: storageConfig.accessKey,
          secretKey: storageConfig.secretKey,
        });
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule implements OnModuleInit {
  constructor(private readonly storage: StorageService) {}

  async onModuleInit() {
    await this.storage.ensureBucketExists();
  }
}
