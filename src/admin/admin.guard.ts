import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const isAdmin = req.session.admin === true;

    if (!isAdmin) {
      res.redirect('/admin/login');
      return false;
    }

    return true;
  }
}
