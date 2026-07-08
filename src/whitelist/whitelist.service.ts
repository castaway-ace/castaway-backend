import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWhitelistEntryDto } from './dto/create-whitelist-entry.dto.js';
import { UpdateWhitelistEntryDto } from './dto/update-whitelist-entry.dto.js';
import { WhitelistEntryEntity } from './whitelist.entity.js';

@Injectable()
export class WhitelistService {
  constructor(private readonly prisma: PrismaService) {}

  async isWhitelisted(email: string): Promise<boolean> {
    const entry = await this.prisma.emailWhitelist.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    return entry !== null;
  }

  async findAll(): Promise<WhitelistEntryEntity[]> {
    return this.prisma.emailWhitelist.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateWhitelistEntryDto): Promise<WhitelistEntryEntity> {
    return this.prisma.emailWhitelist.create({
      data: {
        email: dto.email.toLowerCase(),
        note: dto.note ?? null,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateWhitelistEntryDto,
  ): Promise<WhitelistEntryEntity> {
    const existing = await this.prisma.emailWhitelist.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Whitelist entry not found');
    }

    const nextEmail = dto.email?.toLowerCase();

    const updated = await this.prisma.emailWhitelist.update({
      where: { id },
      data: {
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });

    if (nextEmail !== undefined && nextEmail !== existing.email) {
      await this.revokeSessionsByEmail(existing.email);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.prisma.emailWhitelist.delete({
      where: { id },
    });

    await this.revokeSessionsByEmail(deleted.email);
  }

  private async revokeSessionsByEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!user) {
      return;
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    if (devices.length === 0) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        deviceId: { in: devices.map((device) => device.id) },
        invalidatedAt: null,
      },
      data: { invalidatedAt: new Date() },
    });
  }
}
