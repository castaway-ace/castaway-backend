import { ApiProperty } from '@nestjs/swagger';
import { User } from './users.types.js';
import { Role } from '../generated/prisma/client.js';

export class UserEntity implements User {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  userName!: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles!: Role[];
}
