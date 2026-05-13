import { Injectable } from '@nestjs/common';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { Album, Artist, Track } from '../../generated/prisma/client.js';

export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
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
      this.artistService.findArtists(userId, {
        filters: { search: query },
        pagination: { limit: 10 },
      }),
      this.albumService.findAlbums(userId, {
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
