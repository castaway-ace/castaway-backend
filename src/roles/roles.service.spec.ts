import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service.js';
import { UsersService } from '../users/users.service.js';
import { RefreshTokenService } from '../refresh-token/refresh-token.service.js';
import { Role } from '../generated/prisma/client.js';
import { Permission } from '../auth/rbac/permissions.js';
import { UserEntity } from '../users/users.entity.js';

const adminUser: UserEntity = {
  id: 'user-1',
  email: 'a@b.com',
  userName: 'tester',
  isAdmin: false,
  roles: [Role.ADMIN],
};

const regularUser: UserEntity = { ...adminUser, roles: [Role.USER] };

describe('RolesService', () => {
  let service: RolesService;

  const setRoles = jest.fn<UsersService['setRoles']>();
  const findAll = jest.fn<UsersService['findAll']>();
  const findById = jest.fn<UsersService['findById']>();
  const countByRole = jest.fn<UsersService['countByRole']>();
  const revokeSessionsForUser =
    jest.fn<RefreshTokenService['revokeSessionsForUser']>();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: UsersService,
          useValue: { setRoles, findAll, findById, countByRole },
        },
        { provide: RefreshTokenService, useValue: { revokeSessionsForUser } },
      ],
    }).compile();

    service = module.get(RolesService);
  });

  describe('getRoleCatalog', () => {
    it('returns every role with the permissions it grants', () => {
      const catalog = service.getRoleCatalog();

      const admin = catalog.find((entry) => entry.role === Role.ADMIN);
      const user = catalog.find((entry) => entry.role === Role.USER);

      expect(catalog).toHaveLength(2);
      expect(admin?.permissions).toContain(Permission.RoleManage);
      expect(user?.permissions).toEqual([]);
    });
  });

  describe('listUsers', () => {
    it('delegates to the users service', async () => {
      findAll.mockResolvedValue([adminUser]);

      await expect(service.listUsers()).resolves.toEqual([adminUser]);
      expect(findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('setUserRoles', () => {
    it('updates the roles and then revokes the user sessions', async () => {
      findById.mockResolvedValue(adminUser);
      setRoles.mockResolvedValue(adminUser);

      const result = await service.setUserRoles('user-1', [Role.ADMIN]);

      expect(result).toEqual(adminUser);
      expect(setRoles).toHaveBeenCalledWith('user-1', [Role.ADMIN]);
      expect(revokeSessionsForUser).toHaveBeenCalledWith('user-1');
    });

    it('does not revoke sessions when the role update fails', async () => {
      findById.mockResolvedValue(adminUser);
      setRoles.mockRejectedValue(new Error('user not found'));

      await expect(
        service.setUserRoles('user-1', [Role.ADMIN]),
      ).rejects.toThrow();
      expect(revokeSessionsForUser).not.toHaveBeenCalled();
    });

    it('refuses to strip ADMIN from the last administrator', async () => {
      findById.mockResolvedValue(adminUser);
      countByRole.mockResolvedValue(1);

      await expect(service.setUserRoles('user-1', [Role.USER])).rejects.toThrow(
        ConflictException,
      );
      expect(setRoles).not.toHaveBeenCalled();
      expect(revokeSessionsForUser).not.toHaveBeenCalled();
    });

    it('allows demoting an admin while other admins remain', async () => {
      findById.mockResolvedValue(adminUser);
      countByRole.mockResolvedValue(2);
      setRoles.mockResolvedValue(regularUser);

      const result = await service.setUserRoles('user-1', [Role.USER]);

      expect(result).toEqual(regularUser);
      expect(setRoles).toHaveBeenCalledWith('user-1', [Role.USER]);
      expect(revokeSessionsForUser).toHaveBeenCalledWith('user-1');
    });

    it('does not count admins when ADMIN is being kept or added', async () => {
      findById.mockResolvedValue(regularUser);
      setRoles.mockResolvedValue(adminUser);

      await service.setUserRoles('user-1', [Role.ADMIN]);

      expect(countByRole).not.toHaveBeenCalled();
      expect(setRoles).toHaveBeenCalledWith('user-1', [Role.ADMIN]);
    });
  });
});
