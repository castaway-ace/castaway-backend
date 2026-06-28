import { ApiProperty } from '@nestjs/swagger';

export class ReferralCodeEntity {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  createdAt!: Date;
}
