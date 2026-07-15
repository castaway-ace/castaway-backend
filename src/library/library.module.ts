import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';

@Module({
  imports: [PlaylistsModule, AlbumsModule, ArtistsModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
