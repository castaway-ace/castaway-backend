import { Injectable } from '@nestjs/common';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { TrackSummary } from '../types/tracks.js';
import { AlbumSummary } from '../types/albums.js';
import { ArtistSummary } from '../types/artists.js';

export interface SearchResults {
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  tracks: TrackSummary[];
}

@Injectable()
export class SearchService {
  constructor(
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly trackService: TracksService,
  ) {}

  async search(query: string, userId: string): Promise<SearchResults> {
    if (query.trim().length < 2) {
      return { artists: [], albums: [], tracks: [] };
    }

    const [artists, albums, tracks] = await Promise.all([
      this.artistService.findAll(userId, {
        filters: { search: query },
        pagination: { limit: 10 },
      }),
      this.albumService.findAll(userId, {
        filters: { search: query },
        pagination: { limit: 10 },
      }),
      this.trackService.findTracks(userId, {
        filters: { search: query },
        pagination: { limit: 10 },
      }),
    ]);

    return { artists, albums, tracks };
  }
}
