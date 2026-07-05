import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Device } from '../generated/prisma/client.js';
import { DeviceDto } from './dto/device.dto.js';

interface DeviceUpsertCall {
  where: { userId_clientId: { userId: string; clientId: string } };
  update: { lastSeenAt?: Date; name?: string; model?: string };
  create: { userId: string; clientId: string; name?: string; model?: string };
}

const userId = 'user-1';

const deviceRow: Device = {
  id: 'device-1',
  userId,
  clientId: '11111111-1111-1111-1111-111111111111',
  name: 'Ant Phone',
  model: 'Pixel 9',
  activatedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('DeviceService', () => {
  let deviceService: DeviceService;

  const mockPrismaService = {
    device: {
      upsert: jest.fn<(args: DeviceUpsertCall) => Promise<Device>>(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.device.upsert.mockResolvedValue(deviceRow);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    deviceService = module.get(DeviceService);
  });

  describe('findOrCreate', () => {
    const deviceInfo: DeviceDto = {
      clientId: '11111111-1111-1111-1111-111111111111',
      name: 'Ant Phone',
      model: 'Pixel 9',
    };

    it('upserts keyed by userId and clientId', async () => {
      await deviceService.findOrCreate(userId, deviceInfo);

      const args = mockPrismaService.device.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        userId_clientId: { userId, clientId: deviceInfo.clientId },
      });
    });

    it('creates a new device with the reported name and model', async () => {
      await deviceService.findOrCreate(userId, deviceInfo);

      const args = mockPrismaService.device.upsert.mock.calls[0][0];
      expect(args.create).toEqual({
        userId,
        clientId: deviceInfo.clientId,
        name: 'Ant Phone',
        model: 'Pixel 9',
      });
    });

    it('refreshes lastSeenAt, name, and model on the update branch', async () => {
      await deviceService.findOrCreate(userId, deviceInfo);

      const args = mockPrismaService.device.upsert.mock.calls[0][0];
      expect(args.update.lastSeenAt).toBeInstanceOf(Date);
      expect(args.update.name).toBe('Ant Phone');
      expect(args.update.model).toBe('Pixel 9');
    });

    it('leaves name/model undefined when not reported so Prisma omits them', async () => {
      await deviceService.findOrCreate(userId, {
        clientId: deviceInfo.clientId,
      });

      const args = mockPrismaService.device.upsert.mock.calls[0][0];
      expect(args.update.name).toBeUndefined();
      expect(args.update.model).toBeUndefined();
      expect(args.create.name).toBeUndefined();
      expect(args.create.model).toBeUndefined();
    });

    it('returns the upserted device row', async () => {
      const result = await deviceService.findOrCreate(userId, deviceInfo);
      expect(result).toBe(deviceRow);
    });
  });
});
