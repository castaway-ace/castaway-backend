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
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UserEntity } from '../dto/user.dto.js';

@Controller('user')
@UseGuards(AuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async find(@CurrentUser('sub') sub: string): Promise<UserEntity> {
    const foundUser = await this.userService.findById(sub);
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    return new UserEntity(foundUser);
  }

  @Delete('me')
  async delete(@CurrentUser('sub') sub: string): Promise<void> {
    try {
      await this.userService.delete(sub);
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
