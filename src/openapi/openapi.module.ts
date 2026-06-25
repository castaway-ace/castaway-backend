import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller.js';
import { GuardModule } from '../auth/guard.module.js';
import { OpenApiService } from './openapi.service.js';

@Module({
  imports: [GuardModule],
  controllers: [OpenApiController],
  providers: [OpenApiService],
})
export class OpenApiModule {}
