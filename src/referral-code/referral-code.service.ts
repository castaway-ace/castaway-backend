import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { ReferralCodeEntity } from './referral-code.entity.js';

@Injectable()
export class ReferralCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<ReferralCodeEntity> {
    return this.prisma.referralCode.create({
      data: {
        createdById: userId,
        code: this.generateCode(),
      },
      select: {
        code: true,
        createdAt: true,
      },
    });
  }

  private generateCode(): string {
    return randomBytes(10).toString('base64url');
  }
}
