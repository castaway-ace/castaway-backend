import { Test } from '@nestjs/testing';
import { databaseConfig } from '../config/database.config.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('constructs with a database config', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: databaseConfig.KEY,
          useValue: { url: 'postgresql://test:test@localhost:5432/test' },
        },
      ],
    }).compile();

    const service = moduleRef.get(PrismaService);

    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('PrismaService');
  });

  it('implements lifecycle hooks', () => {
    const service: Pick<PrismaService, 'onModuleInit' | 'onModuleDestroy'> =
      {} as PrismaService;

    expect(typeof PrismaService.prototype.onModuleInit).toBe('function');
    expect(typeof PrismaService.prototype.onModuleDestroy).toBe('function');
  });
});