import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { ReferralCodeService } from './referral-code.service.js';

const moduleMocker = new ModuleMocker(global);

describe('ReferralCodeService', () => {
  let referralCodeService: ReferralCodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReferralCodeService],
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

    referralCodeService = module.get(ReferralCodeService);
  });

  it('should be defined', () => {
    expect(referralCodeService).toBeDefined();
  });
});
