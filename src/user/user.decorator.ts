import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types.js';

interface RequestWithJwtPayload extends Request {
  user: JwtPayload;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest<RequestWithJwtPayload>().user;
  },
);
