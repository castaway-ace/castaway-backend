import { Controller, Delete, Get } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UserEntity } from './users.entity.js';
import { ApiOkResponse } from '@nestjs/swagger';

@Controller('user')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

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
