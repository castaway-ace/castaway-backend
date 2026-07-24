import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { UploadSessionsController } from './upload-sessions.controller.js';
import { UploadSessionsService } from './upload-sessions.service.js';

/**
 * Presigned direct-to-storage upload sessions for the async album ingest flow.
 * PrismaService and ConfigService are provided globally.
 */
@Module({
  imports: [StorageModule],
  controllers: [UploadSessionsController],
  providers: [UploadSessionsService],
})
export class UploadSessionsModule {}
