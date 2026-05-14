import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Device } from '../../generated/prisma/client.js';
import { DeviceInfoDto } from '../dto/device.dto.js';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndInfo(
    userId: string,
    deviceInfo: DeviceInfoDto,
  ): Promise<Device | null> {
    return this.prisma.device.findFirst({
      where: { name: deviceInfo.name, model: deviceInfo.model, userId },
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
