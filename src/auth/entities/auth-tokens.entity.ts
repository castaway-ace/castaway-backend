import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensEntity {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
