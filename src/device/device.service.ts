import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Device } from '../../generated/prisma/client.js';
import { DeviceDto } from './dto/device.dto.js';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(userId: string, deviceInfo: DeviceDto): Promise<Device> {
    return this.prisma.device.upsert({
      where: { userId_clientId: { userId, clientId: deviceInfo.clientId } },
      update: { lastSeenAt: new Date() },
      create: {
        userId,
        clientId: deviceInfo.clientId,
        name: deviceInfo.name,
        model: deviceInfo.model,
      },
    });
  }
}
