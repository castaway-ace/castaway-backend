import { Module } from '@nestjs/common';
import { ReferralCodeService } from './referral-code.service.js';

@Module({
  providers: [ReferralCodeService],
  exports: [ReferralCodeService],
})
export class ReferralCodeModule {}
