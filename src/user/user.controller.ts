import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UserEntity } from './user.entity.js';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOkResponse({ type: UserEntity })
  async find(@CurrentUser('sub') sub: string): Promise<UserEntity> {
    const user = await this.userService.findById(sub);
    return user;
  }

  @Delete('me')
  async delete(@CurrentUser('sub') sub: string): Promise<void> {
    await this.userService.delete(sub);
  }
}
