import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../../generated/prisma/client.js';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      return Boolean(result);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error: unknown) {
      return true;
    }
  }

  handleRequest<TUser = User>(
    err: Error | null,
    user: TUser,
  ): TUser | undefined {
    return user || undefined;
  }
}
