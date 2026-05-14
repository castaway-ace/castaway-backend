import { Exclude } from 'class-transformer';
import { User } from '../../generated/prisma/client.js';

export class UserEntity {
  @Exclude()
  password!: string;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
