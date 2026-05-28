import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SignUpDto } from '../dto/sign-up.dto.js';

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

  async create(user: SignUpDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        userName: user.userName,
        email: user.email,
        password: user.password,
      },
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
