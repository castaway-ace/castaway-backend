import { Injectable } from '@nestjs/common';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { SearchResultsEntity } from './search.entity.js';

const SEARCH_RESULT_LIMIT = 10;

@Injectable()
export class SearchService {
  constructor(
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly trackService: TracksService,
  ) {}

  async find(userId: string, query: string): Promise<SearchResultsEntity> {
    const search = query.trim();

    if (search.length < 1) {
      return { artists: [], albums: [], tracks: [] };
    }

    const [artists, albums, tracks] = await Promise.all([
      this.artistService.findAll(userId, {
        filters: { search },
        pagination: { limit: SEARCH_RESULT_LIMIT },
      }),
      this.albumService.findAll(userId, {
        filters: { search },
        pagination: { limit: SEARCH_RESULT_LIMIT },
      }),
      this.trackService.findAll(userId, {
        filters: { search },
        pagination: { limit: SEARCH_RESULT_LIMIT },
      }),
    ]);

    return { artists, albums, tracks };
  }
}
