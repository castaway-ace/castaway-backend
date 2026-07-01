import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';
import { PlaylistsModule } from '../playlists/playlists.module.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';

@Module({
  imports: [PlaylistsModule, AlbumsModule, ArtistsModule],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {}
