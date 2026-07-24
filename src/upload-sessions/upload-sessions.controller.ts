import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UploadSessionsService } from './upload-sessions.service.js';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto.js';
import { CreateUploadSessionResponse } from './upload-sessions.entity.js';

@Controller('admin/upload-sessions')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@ApiTags('Admin')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({ description: 'Requires admin privileges.' })
export class UploadSessionsController {
  constructor(private readonly uploadSessionsService: UploadSessionsService) {}

  @Post()
  @ApiCreatedResponse({ type: CreateUploadSessionResponse })
  @ApiBadRequestResponse({ description: 'Invalid file descriptors.' })
  createSession(
    @Body() dto: CreateUploadSessionDto,
    @CurrentUser('sub') createdBy: string,
  ): Promise<CreateUploadSessionResponse> {
    return this.uploadSessionsService.createSession(dto.files, createdBy);
  }
}
