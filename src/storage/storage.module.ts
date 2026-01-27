import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageService } from './storage.service.js';
import { StorageController } from './storage.controller.js';
import { StorageConfig } from 'src/config/config.types.js';

@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: 'MINIO_CLIENT',
      useFactory: (configService: ConfigService) => {
        const config = configService.get<StorageConfig>('storage');

        if (!config) {
          throw new Error('Storage configuration not found');
        }

        return new Minio.Client({
          endPoint: config.endpoint,
          port: config.port,
          useSSL: config.useSSL,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
        });
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: ['MINIO_CLIENT', StorageService],
})
export class StorageModule implements OnModuleInit {
  constructor(private readonly storageService: StorageService) {}

  async onModuleInit() {
    await this.storageService.ensureBucketExists();
  }
}
