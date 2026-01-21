import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    const userId = req['user'].sub;

    console.log('Getting user info for:', userId);

    const user = await this.userService.findById(userId);

    if (!user) {
      return { error: 'User not found' };
    }

    // Return user without sensitive OAuth tokens
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      createdAt: user.createdAt,
      linkedProviders: user.accounts.map(account => ({
        provider: account.provider,
        linkedAt: account.createdAt,
      })),
    };
  }
}