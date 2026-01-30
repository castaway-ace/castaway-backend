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
import { type AuthenticatedUser, CurrentUser } from '../user/user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';

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
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackId: string; duration?: number },
  ) {
    if (!body.trackId) {
      throw new BadRequestException('Track ID is required');
    }

    const result = await this.historyService.recordPlay(
      user.userId,
      body.trackId,
      body.duration,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Get recent plays
   * GET /history/recent?limit=50
   */
  @Get('/recent')
  async getRecentPlays(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const history = await this.historyService.getRecentPlays(
      user.userId,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      statusCode: HttpStatus.OK,
      data: history,
    };
  }
}
