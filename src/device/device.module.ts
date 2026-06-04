import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DeviceService } from './device.service.js';

@Module({
  providers: [DeviceService, PrismaService],
  exports: [DeviceService],
})
export class DeviceModule {}
