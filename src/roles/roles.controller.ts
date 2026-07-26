import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Permission } from '../auth/rbac/permissions.js';
import { RolesService } from './roles.service.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { UserEntity } from '../users/users.entity.js';
import { RoleCatalogEntity } from './entities/role-catalog.entity.js';

@Controller('admin')
@RequirePermissions(Permission.RoleManage)
@ApiBearerAuth()
@ApiTags('Admin')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({ description: 'Insufficient permissions.' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @ApiOkResponse({ type: RoleCatalogEntity, isArray: true })
  getRoles(): RoleCatalogEntity[] {
    return this.rolesService.getRoleCatalog();
  }

  @Get('users')
  @ApiOkResponse({ type: UserEntity, isArray: true })
  listUsers(): Promise<UserEntity[]> {
    return this.rolesService.listUsers();
  }

  @Put('users/:id/roles')
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found.' })
  setUserRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
  ): Promise<UserEntity> {
    return this.rolesService.setUserRoles(id, dto.roles);
  }
}
