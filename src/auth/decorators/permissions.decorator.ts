import { SetMetadata } from '@nestjs/common';
import { Permission } from '../rbac/permissions.js';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Require the caller to hold *every* listed permission. Enforced by the global
 * PermissionsGuard; endpoints with no @RequirePermissions only need
 * authentication.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
