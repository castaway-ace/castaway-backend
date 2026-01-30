import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { CurrentUser, type AuthenticatedUser } from '../user/user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-oauth.guard.js';

@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}
  /**
   * Get current queue
   * GET /queue
   */
  @Get('/')
  async getQueue(@CurrentUser() user: AuthenticatedUser) {
    const queue = await this.queueService.getQueue(user.userId);

    return {
      statusCode: HttpStatus.OK,
      data: queue,
    };
  }

  /**
   * Set queue from source
   * POST /queue
   * Body: { trackIds: string[], currentTrackId?: string }
   */
  @Post('/')
  async setQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[]; currentTrackId?: string },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.queueService.setQueue(
      user.userId,
      body.trackIds,
      body.currentTrackId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Update queue state
   * PATCH /queue
   * Body: { currentTrackId?: string, position?: number, shuffleEnabled?: boolean, repeatMode?: string }
   */
  @Patch('/')
  async updateQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      currentTrackId?: string;
      position?: number;
      shuffleEnabled?: boolean;
      repeatMode?: 'OFF' | 'ONE' | 'ALL';
    },
  ) {
    const result = await this.queueService.updateQueue(user.userId, body);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Add tracks to queue
   * POST /queue/tracks
   * Body: { trackIds: string[] }
   */
  @Post('/tracks')
  async addToQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { trackIds: string[] },
  ) {
    if (!body.trackIds || body.trackIds.length === 0) {
      throw new BadRequestException('Track IDs are required');
    }

    const result = await this.queueService.addToQueue(
      user.userId,
      body.trackIds,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Remove item from queue
   * DELETE /queue/items/:id
   */
  @Delete('/items/:id')
  async removeFromQueue(@Param('id') id: string) {
    const result = await this.queueService.removeFromQueue(id);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }

  /**
   * Reorder queue items
   * PATCH /queue/reorder
   * Body: { updates: Array<{ id: string, position: number }> }
   */
  @Patch('/reorder')
  async reorderQueue(
    @Body() body: { updates: Array<{ id: string; position: number }> },
  ) {
    if (!body.updates || body.updates.length === 0) {
      throw new BadRequestException('Updates are required');
    }

    const result = await this.queueService.reorderQueue(body.updates);

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
    };
  }
}
