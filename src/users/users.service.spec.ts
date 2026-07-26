import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Role } from '../generated/prisma/client.js';
import { User, userSelect, UserWithPassword } from './users.types.js';

const user: User = {
  id: 'user-1',
  email: 'test@test.com',
  userName: 'tester',
  isAdmin: false,
  roles: [Role.USER],
};

const userWithPassword: UserWithPassword = {
  ...user,
  passwordHash: 'argon2-hash',
};

const createData = {
  email: 'test@test.com',
  userName: 'tester',
  passwordHash: 'argon2-hash',
};

describe('UsersService', () => {
  let usersService: UsersService;

  const mockPrismaService = {
    user: {
      findUnique:
        jest.fn<
          (
            args: Prisma.UserFindUniqueArgs,
          ) => Promise<User | UserWithPassword | null>
        >(),
      create: jest.fn<(args: Prisma.UserCreateArgs) => Promise<User>>(),
      update: jest.fn<(args: Prisma.UserUpdateArgs) => Promise<User>>(),
      findMany: jest.fn<(args: Prisma.UserFindManyArgs) => Promise<User[]>>(),
      count: jest.fn<(args: Prisma.UserCountArgs) => Promise<number>>(),
      deleteMany:
        jest.fn<
          (args: Prisma.UserDeleteManyArgs) => Promise<{ count: number }>
        >(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    usersService = module.get(UsersService);
  });

  describe('findByEmail', () => {
    it('returns the user including the password hash for auth', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userWithPassword);

      const result = await usersService.findByEmail('test@test.com');

      expect(result).toEqual(userWithPassword);

      const [findArgs] = mockPrismaService.user.findUnique.mock.calls[0];
      expect(findArgs).toMatchObject({
        where: { email: 'test@test.com' },
      });
    });

    it('returns null when no user matches', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findByEmail('missing@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user entity', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await usersService.findById('user-1');

      expect(result).toEqual(user);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(usersService.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns every user with the shared select', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([user]);

      const result = await usersService.findAll();

      expect(result).toEqual([user]);
      const [findArgs] = mockPrismaService.user.findMany.mock.calls[0];
      expect(findArgs).toMatchObject({ select: userSelect });
    });
  });

  describe('setRoles', () => {
    it('updates the roles and returns the entity', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue({
        ...user,
        roles: [Role.ADMIN],
      });

      const result = await usersService.setRoles('user-1', [Role.ADMIN]);

      expect(result).toEqual({ ...user, roles: [Role.ADMIN] });
      const [updateArgs] = mockPrismaService.user.update.mock.calls[0];
      expect(updateArgs).toMatchObject({
        where: { id: 'user-1' },
        data: { roles: [Role.ADMIN] },
        select: userSelect,
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        usersService.setRoles('missing', [Role.ADMIN]),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('countByRole', () => {
    it('counts users that hold the given role', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);

      const result = await usersService.countByRole(Role.ADMIN);

      expect(result).toBe(3);
      const [countArgs] = mockPrismaService.user.count.mock.calls[0];
      expect(countArgs).toMatchObject({
        where: { roles: { has: Role.ADMIN } },
      });
    });
  });

  describe('create', () => {
    it('creates the user and never selects the password hash', async () => {
      mockPrismaService.user.create.mockResolvedValue(user);

      const result = await usersService.create(createData);

      expect(result).toEqual(user);

      const [createArgs] = mockPrismaService.user.create.mock.calls[0];
      expect(createArgs).toMatchObject({
        data: createData,
        select: userSelect,
      });
      expect(createArgs.select).not.toHaveProperty('passwordHash');
    });
  });

  describe('createAdmin', () => {
    it('forces isAdmin regardless of the input', async () => {
      mockPrismaService.user.create.mockResolvedValue({
        ...user,
        isAdmin: true,
      });

      await usersService.createAdmin(createData);

      const [createArgs] = mockPrismaService.user.create.mock.calls[0];
      expect(createArgs).toMatchObject({
        data: { ...createData, isAdmin: true },
      });
    });
  });

  describe('upgradeAdmin', () => {
    it('sets the admin flag on the user', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        ...user,
        isAdmin: true,
      });

      await usersService.upgradeAdmin('user-1');

      const [updateArgs] = mockPrismaService.user.update.mock.calls[0];
      expect(updateArgs).toMatchObject({
        where: { id: 'user-1' },
        data: { isAdmin: true },
      });
    });
  });

  describe('delete', () => {
    it('deletes by id without failing on a missing user', async () => {
      mockPrismaService.user.deleteMany.mockResolvedValue({ count: 0 });

      await usersService.delete('user-1');

      const [deleteArgs] = mockPrismaService.user.deleteMany.mock.calls[0];
      expect(deleteArgs).toMatchObject({ where: { id: 'user-1' } });
    });
  });
});
