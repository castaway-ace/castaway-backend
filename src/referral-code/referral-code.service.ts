import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<void> {
    await this.prisma.referralCode.create({
      data: {
        createdById: userId,
        code: this.generateCode(),
      },
    });
  }

  private generateCode(): string {
    return randomBytes(10).toString('base64url');
  }
}
