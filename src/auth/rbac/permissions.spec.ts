import { Role } from '../../generated/prisma/client.js';
import {
  Permission,
  ROLE_PERMISSIONS,
  permissionsForRoles,
} from './permissions.js';

describe('RBAC permission catalog', () => {
  it('grants ADMIN every permission', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toEqual(Object.values(Permission));
  });

  it('grants USER no privileged permissions', () => {
    expect(ROLE_PERMISSIONS.USER).toEqual([]);
  });

  it('declares a permission list for every role', () => {
    for (const role of Object.values(Role)) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  describe('permissionsForRoles', () => {
    it('unions the permissions across the given roles', () => {
      const result = permissionsForRoles([Role.ADMIN, Role.USER]);

      expect(result.has(Permission.RoleManage)).toBe(true);
      expect(result.size).toBe(Object.values(Permission).length);
    });

    it('returns an empty set for the USER role alone', () => {
      expect(permissionsForRoles([Role.USER]).size).toBe(0);
    });

    it('returns an empty set when no roles are held', () => {
      expect(permissionsForRoles([]).size).toBe(0);
    });
  });
});
