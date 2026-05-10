import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Device } from '../../generated/prisma/client.js';
import { DeviceInfoDto } from '../dto/device-info.dto.js';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Device | null> {
    return this.prisma.device.findUnique({
      where: { id },
    });
  }

  async create(userId: string, deviceInfo: DeviceInfoDto): Promise<Device> {
    return this.prisma.device.create({
      data: {
        userId,
        name: deviceInfo.name,
        model: deviceInfo.model,
      },
    });
  }
}
