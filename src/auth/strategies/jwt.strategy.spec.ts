import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload } from './jwt.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole } from '../../generated/prisma/client.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let findUniqueMock: jest.Mock;

  const mockPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: UserRole.USER,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: 'admin-123',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    findUniqueMock = jest.fn();

    const mockPrismaService = {
      user: {
        findUnique: findUniqueMock,
      },
    } as unknown as jest.Mocked<PrismaService>;

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'auth.jwt.secret') return 'test-secret';
        return '';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate and return user from database', async () => {
      findUniqueMock.mockResolvedValue(mockUser);

      const result = await strategy.validate(mockPayload);

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should validate and return admin user with admin role', async () => {
      const adminPayload: JwtPayload = {
        ...mockPayload,
        sub: 'admin-123',
        role: UserRole.ADMIN,
      };

      findUniqueMock.mockResolvedValue(mockAdminUser);

      const result = await strategy.validate(adminPayload);

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { id: 'admin-123' },
      });
      expect(result).toEqual(mockAdminUser);
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('User no longer exists'),
      );
    });

    it('should return fresh user data even if JWT payload is stale', async () => {
      const stalePayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
      };

      const promotedUser = {
        ...mockUser,
        role: UserRole.ADMIN,
      };

      findUniqueMock.mockResolvedValue(promotedUser);

      const result = await strategy.validate(stalePayload);

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should handle user with null name', async () => {
      const userWithNullName = {
        ...mockUser,
        name: null,
      };

      findUniqueMock.mockResolvedValue(userWithNullName);

      const result = await strategy.validate(mockPayload);

      expect(result.name).toBeNull();
      expect(result.role).toBe(UserRole.USER);
    });

    it('should query database on every validation', async () => {
      findUniqueMock.mockResolvedValue(mockUser);

      await strategy.validate(mockPayload);
      await strategy.validate(mockPayload);
      await strategy.validate(mockPayload);

      expect(findUniqueMock).toHaveBeenCalledTimes(3);
    });

    it('should prevent deleted users from accessing resources', async () => {
      findUniqueMock.mockResolvedValue(null);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
