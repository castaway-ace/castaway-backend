import { ConflictException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { UserEntity } from '../users/users.entity.js';
import { Role } from '../generated/prisma/client.js';
import { ROLE_PERMISSIONS } from '../auth/rbac/permissions.js';
import { RoleCatalogEntity } from './entities/role-catalog.entity.js';

@Injectable()
export class RolesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** The code-defined roles and the permissions each one grants. */
  getRoleCatalog(): RoleCatalogEntity[] {
    return Object.values(Role).map((role) => ({
      role,
      permissions: ROLE_PERMISSIONS[role],
    }));
  }

  listUsers(): Promise<UserEntity[]> {
    return this.usersService.findAll();
  }

  async setUserRoles(id: string, roles: Role[]): Promise<UserEntity> {
    const current = await this.usersService.findById(id);

    // Guard against locking everyone out of role management: the last account
    // that still holds ADMIN cannot have that role removed.
    const removingAdmin =
      current.roles.includes(Role.ADMIN) && !roles.includes(Role.ADMIN);
    if (removingAdmin) {
      const adminCount = await this.usersService.countByRole(Role.ADMIN);
      if (adminCount <= 1) {
        throw new ConflictException('Cannot remove the last administrator');
      }
    }

    const user = await this.usersService.setRoles(id, roles);
    // End the target user's active sessions so the change takes effect now:
    // their JWT still carries the old roles until it expires, so we force a
    // fresh login that mints a token with the new roles.
    await this.refreshTokenService.revokeSessionsForUser(id);
    return user;
  }
}
