import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WhitelistService } from './whitelist.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WhitelistEntryEntity } from './whitelist.entity.js';

const makeEntry = (
  overrides: Partial<WhitelistEntryEntity> = {},
): WhitelistEntryEntity => ({
  id: 'wl-1',
  email: 'user@example.com',
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('WhitelistService', () => {
  let service: WhitelistService;

  const whitelistFindUnique = jest.fn<() => Promise<unknown>>();
  const whitelistFindMany = jest.fn<() => Promise<unknown>>();
  const whitelistCreate = jest.fn<() => Promise<unknown>>();
  const whitelistUpdate = jest.fn<() => Promise<unknown>>();
  const whitelistDelete = jest.fn<() => Promise<unknown>>();
  const userFindFirst = jest.fn<() => Promise<unknown>>();
  const deviceFindMany = jest.fn<() => Promise<unknown>>();
  const refreshTokenUpdateMany =
    jest.fn<
      (args: {
        where: { deviceId: { in: string[] }; invalidatedAt: null };
      }) => Promise<unknown>
    >();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhitelistService,
        {
          provide: PrismaService,
          useValue: {
            emailWhitelist: {
              findUnique: whitelistFindUnique,
              findMany: whitelistFindMany,
              create: whitelistCreate,
              update: whitelistUpdate,
              delete: whitelistDelete,
            },
            user: { findFirst: userFindFirst },
            device: { findMany: deviceFindMany },
            refreshToken: { updateMany: refreshTokenUpdateMany },
          },
        },
      ],
    }).compile();

    service = module.get(WhitelistService);
  });

  describe('isWhitelisted', () => {
    it('lowercases the candidate and returns true when found', async () => {
      whitelistFindUnique.mockResolvedValue({ id: 'wl-1' });

      await expect(service.isWhitelisted('User@Example.COM')).resolves.toBe(
        true,
      );
      expect(whitelistFindUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        select: { id: true },
      });
    });

    it('returns false when no entry exists', async () => {
      whitelistFindUnique.mockResolvedValue(null);

      await expect(service.isWhitelisted('nobody@example.com')).resolves.toBe(
        false,
      );
    });
  });

  describe('create', () => {
    it('stores the email lowercased with its note', async () => {
      const created = makeEntry({ email: 'user@example.com', note: 'beta' });
      whitelistCreate.mockResolvedValue(created);

      const result = await service.create({
        email: 'User@Example.com',
        note: 'beta',
      });

      expect(result).toBe(created);
      expect(whitelistCreate).toHaveBeenCalledWith({
        data: { email: 'user@example.com', note: 'beta' },
      });
    });

    it('defaults a missing note to null', async () => {
      whitelistCreate.mockResolvedValue(makeEntry());

      await service.create({ email: 'user@example.com' });

      expect(whitelistCreate).toHaveBeenCalledWith({
        data: { email: 'user@example.com', note: null },
      });
    });
  });

  describe('findAll', () => {
    it('lists entries ordered by creation time', async () => {
      const entries = [makeEntry()];
      whitelistFindMany.mockResolvedValue(entries);

      await expect(service.findAll()).resolves.toBe(entries);
      expect(whitelistFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('throws NotFound when the entry is missing', async () => {
      whitelistFindUnique.mockResolvedValue(null);

      await expect(service.update('missing', { note: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(whitelistUpdate).not.toHaveBeenCalled();
    });

    it('revokes the old email sessions when the email changes', async () => {
      whitelistFindUnique.mockResolvedValue(
        makeEntry({ email: 'old@example.com' }),
      );
      whitelistUpdate.mockResolvedValue(
        makeEntry({ email: 'new@example.com' }),
      );
      userFindFirst.mockResolvedValue({ id: 'user-1' });
      deviceFindMany.mockResolvedValue([{ id: 'dev-1' }]);
      refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

      await service.update('wl-1', { email: 'New@Example.com' });

      expect(whitelistUpdate).toHaveBeenCalledWith({
        where: { id: 'wl-1' },
        data: { email: 'new@example.com' },
      });
      expect(userFindFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'old@example.com', mode: 'insensitive' } },
        select: { id: true },
      });
      expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    });

    it('does not revoke sessions when only the note changes', async () => {
      whitelistFindUnique.mockResolvedValue(
        makeEntry({ email: 'user@example.com' }),
      );
      whitelistUpdate.mockResolvedValue(
        makeEntry({ email: 'user@example.com', note: 'updated' }),
      );

      await service.update('wl-1', { note: 'updated' });

      expect(whitelistUpdate).toHaveBeenCalledWith({
        where: { id: 'wl-1' },
        data: { note: 'updated' },
      });
      expect(userFindFirst).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the entry and revokes the account sessions', async () => {
      whitelistDelete.mockResolvedValue(
        makeEntry({ email: 'gone@example.com' }),
      );
      userFindFirst.mockResolvedValue({ id: 'user-1' });
      deviceFindMany.mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]);
      refreshTokenUpdateMany.mockResolvedValue({ count: 2 });

      await service.remove('wl-1');

      expect(whitelistDelete).toHaveBeenCalledWith({ where: { id: 'wl-1' } });
      const [args] = refreshTokenUpdateMany.mock.calls[0];
      expect(args.where.deviceId.in).toEqual(['dev-1', 'dev-2']);
      expect(args.where.invalidatedAt).toBeNull();
    });

    it('skips revocation when no account holds the email', async () => {
      whitelistDelete.mockResolvedValue(
        makeEntry({ email: 'gone@example.com' }),
      );
      userFindFirst.mockResolvedValue(null);

      await service.remove('wl-1');

      expect(deviceFindMany).not.toHaveBeenCalled();
      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });

    it('skips revocation when the account has no devices', async () => {
      whitelistDelete.mockResolvedValue(
        makeEntry({ email: 'gone@example.com' }),
      );
      userFindFirst.mockResolvedValue({ id: 'user-1' });
      deviceFindMany.mockResolvedValue([]);

      await service.remove('wl-1');

      expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
    });
  });
});
