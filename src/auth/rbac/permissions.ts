import { Role } from '../../generated/prisma/client.js';

/**
 * Granular capabilities enforced by the PermissionsGuard. The set of actions is
 * fixed by the code, so permissions live here rather than in the database —
 * adding one is a code change reviewed alongside the endpoint it protects.
 */
export enum Permission {
  CatalogWrite = 'catalog:write',
  CatalogDelete = 'catalog:delete',
  UploadManage = 'upload:manage',
  WhitelistManage = 'whitelist:manage',
  RoleManage = 'role:manage',
}

/**
 * Role → permissions map. `Record<Role, ...>` makes the compiler reject adding a
 * Role without declaring what it grants. Roles are additive: a user's effective
 * permissions are the union across all of their roles. ADMIN implicitly gains
 * every permission, including ones added later.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: Object.values(Permission),
  USER: [],
};

/** Resolve the effective permission set granted by a collection of roles. */
export function permissionsForRoles(roles: Role[]): Set<Permission> {
  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }
  return permissions;
}
