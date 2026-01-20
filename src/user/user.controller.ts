import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UserController {
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Req() req: Request) {
        console.log({
            user: req['user'],
        });
        return req['user'];
    }

}
