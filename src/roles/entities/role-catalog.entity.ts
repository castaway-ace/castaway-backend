import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { Permission } from '../../auth/rbac/permissions.js';

export class RoleCatalogEntity {
  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];
}
