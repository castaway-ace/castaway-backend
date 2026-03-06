import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HistoryService } from './history.service.js';
import { CurrentUser } from '../user/user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';
import type { JwtPayload } from '../auth/auth.types.js';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}
  /**
   * Record a track play
   * POST /history
   * Body: { trackId: string, duration?: number }
   */
  @Post('/')
  async recordPlay(
    @CurrentUser() user: JwtPayload,
    @Body() body: { trackId: string; duration?: number },
  ) {
    if (!body.trackId) {
      throw new BadRequestException('Track ID is required');
    }

    await this.historyService.recordPlay(user.sub, body.trackId, body.duration);
  }

  /**
   * Get recent plays
   * GET /history/recent?limit=50
   */
  @Get('/recent')
  async getRecentPlays(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const history = await this.historyService.getRecentPlays(
      user.sub,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      statusCode: HttpStatus.OK,
      data: history,
    };
  }
}
