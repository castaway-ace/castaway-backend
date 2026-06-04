import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service.js';
import { MockMetadata, ModuleMocker } from 'jest-mock';

const moduleMocker = new ModuleMocker(global);

describe('DeviceService', () => {
  let deviceService: DeviceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeviceService],
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

    deviceService = module.get(DeviceService);
  });

  it('should be defined', () => {
    expect(deviceService).toBeDefined();
  });
});
