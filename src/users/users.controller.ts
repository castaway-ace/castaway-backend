import { Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../auth/decorators/user.decorator.js';
import { UserEntity } from './users.entity.js';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@Controller('user')
@ApiBearerAuth()
@ApiTags('User')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async find(@CurrentUser('sub') sub: string): Promise<UserEntity> {
    return this.userService.findById(sub);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(@CurrentUser('sub') sub: string): Promise<void> {
    await this.userService.delete(sub);
  }
}
