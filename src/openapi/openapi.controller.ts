import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { OpenApiService } from './openapi.service.js';
import { ApiExcludeEndpoint, type OpenAPIObject } from '@nestjs/swagger';

@Controller('openapi')
export class OpenApiController {
  constructor(private readonly openApiService: OpenApiService) {}

  @Get('json')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiExcludeEndpoint()
  @Header('Content-Disposition', 'attachment; filename="openapi.json"')
  getDocument(): OpenAPIObject {
    return this.openApiService.getDocument();
  }
}
