import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './roles.guard.js';
import { UserRole } from '../../generated/prisma/client.js';
import { UserWithProviders } from '../../user/user.types.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockUser: UserWithProviders = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    providers: [],
  };

  const mockAdminUser: UserWithProviders = {
    ...mockUser,
    id: 'admin-123',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (
    user: UserWithProviders | null,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('when no roles are required', () => {
    it('should allow access if no roles decorator is present', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockExecutionContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when roles are required', () => {
    it('should allow access if user has required role', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.USER]);
      const context = createMockExecutionContext(mockUser);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access if user has admin role and admin is required', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext(mockAdminUser);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access if user does not have required role', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext(mockUser); // Regular user

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should allow access if user has any of multiple required roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN, UserRole.USER]);
      const context = createMockExecutionContext(mockUser); // Has USER role

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access if user has none of the required roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN]);
      const context = createMockExecutionContext({
        ...mockUser,
        role: UserRole.USER,
      });

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny access if no user is present in request', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.USER]);
      const context = createMockExecutionContext(null);

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  describe('reflector usage', () => {
    it('should read roles metadata from handler and class', () => {
      const getAllAndOverrideSpy = jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.USER]);

      const context = createMockExecutionContext(mockUser);
      guard.canActivate(context);

      expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
