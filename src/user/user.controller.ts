import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { User } from '../../generated/prisma/client.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<User> {
    const foundUser = await this.userService.findById(user.sub);
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    return foundUser;
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  async deleteUser(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.userService.delete(user.sub);
  }
}
