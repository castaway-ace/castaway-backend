import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { UploadSessionsController } from './upload-sessions.controller.js';
import { UploadSessionsService } from './upload-sessions.service.js';

/**
 * Presigned direct-to-storage upload sessions for the async album ingest flow.
 * PrismaService and ConfigService are provided globally; QueueModule supplies
 * the album-ingest queue for finalize.
 */
@Module({
  imports: [StorageModule, QueueModule],
  controllers: [UploadSessionsController],
  providers: [UploadSessionsService],
})
export class UploadSessionsModule {}
