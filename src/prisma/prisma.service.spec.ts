import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(prismaService).toBeDefined();
  });
});
