import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  deviceId: string;
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator(
  <K extends keyof AuthenticatedUser | undefined>(
    data: K,
    ctx: ExecutionContext,
  ): K extends keyof AuthenticatedUser
    ? AuthenticatedUser[K]
    : AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (data ? request.user[data] : request.user) as never;
  },
);
