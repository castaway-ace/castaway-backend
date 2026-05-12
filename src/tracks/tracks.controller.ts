import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';

@Controller('tracks')
@UseGuards(AuthGuard)
export class TracksController {
  @Get()
  getTracks(): void {
    console.log('sds');
  }
}
