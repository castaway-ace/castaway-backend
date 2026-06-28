import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AdminUserCreateData,
  UserCreateData,
  userSelect,
  UserWithPassword,
  userWithPasswordSelect,
} from './users.types.js';
import { UserEntity } from './user.entity.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: userWithPasswordSelect,
    });
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    return user;
  }

  async create(user: UserCreateData): Promise<UserEntity> {
    return this.prisma.user.create({
      data: user,
    });
  }

  async createAdmin(user: AdminUserCreateData): Promise<void> {
    await this.prisma.user.create({
      data: user,
    });
  }

  async upgradeAdmin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
      },
      data: {
        isAdmin: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id } });
  }
}
