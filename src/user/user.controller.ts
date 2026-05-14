import {
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/user.decorator.js';
import { UserEntity } from '../dto/user.dto.js';

@Controller('user')
@UseGuards(AuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserEntity> {
    const foundUser = await this.userService.findById(user.sub);
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    return new UserEntity(foundUser);
  }

  @Delete('me')
  async deleteUser(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    try {
      await this.userService.delete(user.sub);
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
