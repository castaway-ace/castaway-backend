import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { AlbumsModule } from '../albums/albums.module.js';
import { ArtistsModule } from '../artists/artists.module.js';
import { TracksModule } from '../tracks/tracks.module.js';

@Module({
  imports: [ArtistsModule, TracksModule, AlbumsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
