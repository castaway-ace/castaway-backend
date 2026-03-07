import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { MusicModule } from '../music/music.module.js';

@Module({
  imports: [MusicModule],
  controllers: [AdminController],
})
export class AdminModule {}
