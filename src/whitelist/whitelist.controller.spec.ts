import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { WhitelistController } from './whitelist.controller.js';
import { WhitelistService } from './whitelist.service.js';
import { WhitelistEntryEntity } from './whitelist.entity.js';

describe('WhitelistController', () => {
  let controller: WhitelistController;

  const mockWhitelistService = {
    create: jest.fn<WhitelistService['create']>(),
    findAll: jest.fn<WhitelistService['findAll']>(),
    update: jest.fn<WhitelistService['update']>(),
    remove: jest.fn<WhitelistService['remove']>(),
  };

  const entry: WhitelistEntryEntity = {
    id: 'wl-1',
    email: 'user@example.com',
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhitelistController],
      providers: [
        { provide: WhitelistService, useValue: mockWhitelistService },
      ],
    }).compile();

    controller = module.get(WhitelistController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('passes the dto to the service', async () => {
      mockWhitelistService.create.mockResolvedValue(entry);

      const dto = { email: 'user@example.com' };
      await expect(controller.create(dto)).resolves.toBe(entry);
      expect(mockWhitelistService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('returns the list from the service', async () => {
      mockWhitelistService.findAll.mockResolvedValue([entry]);

      await expect(controller.findAll()).resolves.toEqual([entry]);
      expect(mockWhitelistService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('passes the id and dto to the service', async () => {
      mockWhitelistService.update.mockResolvedValue(entry);

      const dto = { note: 'beta' };
      await expect(controller.update('wl-1', dto)).resolves.toBe(entry);
      expect(mockWhitelistService.update).toHaveBeenCalledWith('wl-1', dto);
    });
  });

  describe('remove', () => {
    it('passes the id to the service', async () => {
      mockWhitelistService.remove.mockResolvedValue(undefined);

      await controller.remove('wl-1');
      expect(mockWhitelistService.remove).toHaveBeenCalledWith('wl-1');
    });
  });
});
