import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { User } from '../types/users.js';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async find(@CurrentUser('sub') sub: string): Promise<User> {
    const user = await this.userService.findById(sub);
    return user;
  }

  @Delete('me')
  async delete(@CurrentUser('sub') sub: string): Promise<void> {
    await this.userService.delete(sub);
  }
}
