import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UploadSessionsService } from './upload-sessions.service.js';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto.js';
import { CompleteFileDto } from './dto/complete-file.dto.js';
import {
  CreateUploadSessionResponse,
  UploadSessionFileStatus,
  UploadSessionStatusResponse,
} from './upload-sessions.entity.js';

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

  @Get(':id')
  @ApiOkResponse({ type: UploadSessionStatusResponse })
  @ApiNotFoundResponse({ description: 'Upload session not found.' })
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UploadSessionStatusResponse> {
    return this.uploadSessionsService.getStatus(id);
  }

  @Post(':id/files/:fileId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UploadSessionFileStatus })
  @ApiNotFoundResponse({ description: 'Upload file not found.' })
  @ApiBadRequestResponse({ description: 'Missing parts or size mismatch.' })
  completeFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: CompleteFileDto,
  ): Promise<UploadSessionFileStatus> {
    return this.uploadSessionsService.completeFile(id, fileId, dto.parts ?? []);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ description: 'Session queued for ingest.' })
  @ApiNotFoundResponse({ description: 'Upload session not found.' })
  @ApiConflictResponse({
    description: 'Files not fully uploaded, or session not finalizable.',
  })
  async finalizeSession(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.uploadSessionsService.finalizeSession(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Upload session not found.' })
  @ApiConflictResponse({
    description: 'Session cannot be aborted in its current state.',
  })
  async abortSession(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.uploadSessionsService.abortSession(id);
  }
}
