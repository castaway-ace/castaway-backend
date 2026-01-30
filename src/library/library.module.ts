import { Module } from '@nestjs/common';
import { LibraryService } from './library.service.js';
import { LibraryController } from './library.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LibraryRepository } from './library.repository.js';
import { MusicRepository } from '../music/music.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [LibraryController],
  providers: [LibraryService, LibraryRepository, MusicRepository],
})
export class LibraryModule {}
