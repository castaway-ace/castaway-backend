import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { User } from 'generated/prisma/client.js';
import { UserEntity } from '../dto/user.dto.js';
import { instanceToPlain } from 'class-transformer';

const moduleMocker = new ModuleMocker(global);

describe('UserController', () => {
  let userController: UserController;

  const mockUserService = {
    findById: jest.fn<UserService['findById']>(),
    delete: jest.fn<UserService['delete']>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .useMocker((token) => {
        if (typeof token === 'function') {
          const mockMetadata = moduleMocker.getMetadata(token) as MockMetadata<
            any,
            any
          >;
          const Mock = moduleMocker.generateFromMetadata(
            mockMetadata,
          ) as ObjectConstructor;
          return new Mock();
        }
      })
      .compile();

    userController = module.get(UserController);
  });

  describe('find', () => {
    it('should return a user', async () => {
      const mockUser = {
        id: '1',
        password: '1234',
      } as unknown as User;
      mockUserService.findById.mockResolvedValue(mockUser);
      const result = await userController.find('user-1');

      expect(result).toBeInstanceOf(UserEntity);
      expect(instanceToPlain(result)).not.toHaveProperty('password');
      expect(instanceToPlain(result)).toMatchObject({ id: '1' });
    });
  });

  describe('delete', () => {
    it('forwards the user id to the service', async () => {
      await mockUserService.delete('sub');

      expect(mockUserService.delete).toHaveBeenCalledWith('sub');
    });
  });
});
