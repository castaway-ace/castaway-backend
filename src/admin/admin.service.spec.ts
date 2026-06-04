import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AlbumsService } from '../albums/albums.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { TracksService } from '../tracks/tracks.service.js';
describe('AdminService', () => {
  let adminService: AdminService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const MockConfigService = {
      provide: ConfigService,
      useValue: {
        get: jest.fn((Key: string, DefaultValue: string) => {
          switch (Key) {
            case 'STORAGE_ENDPOINT':
              return 'http://localhost:9000';
            case 'STORAGE_REGION':
              return 'us-east-1';
            case 'STORAGE_ACCESS_KEY':
              return 'minioadmin';
            case 'STORAGE_SECRET_ACCESS_KEY':
              return 'minioadmin123';
            default:
              return DefaultValue;
          }
        }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        JwtService,
        MockConfigService,
        StorageService,
        TracksService,
        AlbumsService,
        ArtistsService,
        PrismaService,
      ],
    }).compile();

    adminService = module.get(AdminService);
  });

  it('should be defined', () => {
    expect(adminService).toBeDefined();
  });
});
