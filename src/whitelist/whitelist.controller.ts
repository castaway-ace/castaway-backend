import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
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
import { WhitelistService } from './whitelist.service.js';
import { CreateWhitelistEntryDto } from './dto/create-whitelist-entry.dto.js';
import { UpdateWhitelistEntryDto } from './dto/update-whitelist-entry.dto.js';
import { WhitelistEntryEntity } from './whitelist.entity.js';

@Controller('admin/whitelist')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@ApiTags('Admin')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({ description: 'Requires admin privileges.' })
export class WhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Post()
  @ApiCreatedResponse({ type: WhitelistEntryEntity })
  @ApiConflictResponse({ description: 'Email is already whitelisted.' })
  create(@Body() dto: CreateWhitelistEntryDto): Promise<WhitelistEntryEntity> {
    return this.whitelistService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: WhitelistEntryEntity, isArray: true })
  findAll(): Promise<WhitelistEntryEntity[]> {
    return this.whitelistService.findAll();
  }

  @Patch(':id')
  @ApiOkResponse({ type: WhitelistEntryEntity })
  @ApiNotFoundResponse({ description: 'Whitelist entry not found.' })
  @ApiConflictResponse({ description: 'Email is already whitelisted.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWhitelistEntryDto,
  ): Promise<WhitelistEntryEntity> {
    return this.whitelistService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Whitelist entry not found.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.whitelistService.remove(id);
  }
}
