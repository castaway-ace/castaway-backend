import { AuthenticatedUser } from '../auth/decorators/user.decorator.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
