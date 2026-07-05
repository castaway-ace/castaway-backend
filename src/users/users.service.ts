import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UserCreateData,
  userSelect,
  UserWithPassword,
  userWithPasswordSelect,
} from './users.types.js';
import { UserEntity } from './users.entity.js';

@Injectable()
export class UsersService {
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
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(user: UserCreateData): Promise<UserEntity> {
    return this.prisma.user.create({
      data: user,
      select: userSelect,
    });
  }

  async createAdmin(user: UserCreateData): Promise<void> {
    await this.prisma.user.create({
      data: { ...user, isAdmin: true },
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
