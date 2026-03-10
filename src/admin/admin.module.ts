import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { MusicModule } from '../music/music.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [MusicModule, AuthModule],
  controllers: [AdminController],
})
export class AdminModule {}
