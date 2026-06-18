import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface UserData {
  userName: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(user: UserData): Promise<User> {
    return this.prisma.user.create({
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
    await this.prisma.user.delete({
      where: {
        id,
      },
    });
  }
}
