import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../../generated/prisma/client.js';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = User>(
    err: Error | null,
    user: TUser,
  ): TUser | undefined {
    // No error thrown if user is not found
    // Just returns undefined

    if (err || !user) {
      return undefined;
    }

    return user;
  }
}
