import { ApiProperty } from '@nestjs/swagger';
import { User } from './users.types.js';

export class UserEntity implements User {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty()
  isAdmin!: boolean;
}
