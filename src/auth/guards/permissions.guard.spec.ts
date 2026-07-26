import { jest } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import { Permission } from '../rbac/permissions.js';
import { Role } from '../../generated/prisma/client.js';
import { AuthenticatedUser } from '../decorators/user.decorator.js';

const makeContext = (user?: Partial<AuthenticatedUser>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  const getAllAndOverride = jest.fn<Reflector['getAllAndOverride']>();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  beforeEach(() => jest.clearAllMocks());

  it('allows routes that declare no required permissions', () => {
    getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows routes with an empty required-permissions list', () => {
    getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext({ roles: [Role.USER] }))).toBe(true);
  });

  it('allows a user whose roles grant the required permission', () => {
    getAllAndOverride.mockReturnValue([Permission.CatalogWrite]);
    expect(guard.canActivate(makeContext({ roles: [Role.ADMIN] }))).toBe(true);
  });

  it('grants ADMIN every permission, including several at once', () => {
    getAllAndOverride.mockReturnValue([
      Permission.CatalogWrite,
      Permission.WhitelistManage,
      Permission.RoleManage,
    ]);
    expect(guard.canActivate(makeContext({ roles: [Role.ADMIN] }))).toBe(true);
  });

  it('rejects a user whose roles are missing a required permission', () => {
    getAllAndOverride.mockReturnValue([Permission.CatalogWrite]);
    expect(() =>
      guard.canActivate(makeContext({ roles: [Role.USER] })),
    ).toThrow(ForbiddenException);
  });

  it('rejects when a permission is required but no user is authenticated', () => {
    getAllAndOverride.mockReturnValue([Permission.CatalogWrite]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
