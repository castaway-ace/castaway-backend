import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistSummaryEntity } from '../artists/artists.entity.js';
import { AlbumSummaryEntity } from '../albums/albums.entity.js';
import { TrackSummaryEntity } from '../tracks/tracks.entity.js';

const userId = 'user-1';

const albumRef = { id: 'album-1', title: 'Test Album' };
const artistRef = { id: 'artist-1', name: 'Test Artist', isVarious: false };

const releaseDate = new Date('2026-06-06T00:00:00.000Z');

const artistSummaries: ArtistSummaryEntity[] = [
  { id: 'artist-1', name: 'Test Artist', starred: false, isVarious: false },
];

const albumSummaries: AlbumSummaryEntity[] = [
  {
    id: 'album-1',
    title: 'Test Album',
    releaseDate,
    genres: ['rock'],
    artists: [artistRef],
    starred: false,
  },
];

const trackSummaries: TrackSummaryEntity[] = [
  {
    id: 'track-1',
    title: 'Test Track',
    genres: ['rock'],
    duration: 300,
    releaseDate,
    trackNumber: 1,
    album: albumRef,
    artists: [artistRef],
    starred: false,
  },
];

describe('SearchService', () => {
  let searchService: SearchService;

  const mockArtistsService = {
    findAll: jest
      .fn<ArtistsService['findAll']>()
      .mockResolvedValue(artistSummaries),
  };

  const mockAlbumsService = {
    findAll: jest
      .fn<AlbumsService['findAll']>()
      .mockResolvedValue(albumSummaries),
  };

  const mockTracksService = {
    findAll: jest
      .fn<TracksService['findAll']>()
      .mockResolvedValue(trackSummaries),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockArtistsService.findAll.mockResolvedValue(artistSummaries);
    mockAlbumsService.findAll.mockResolvedValue(albumSummaries);
    mockTracksService.findAll.mockResolvedValue(trackSummaries);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ArtistsService,
          useValue: mockArtistsService,
        },
        {
          provide: AlbumsService,
          useValue: mockAlbumsService,
        },
        {
          provide: TracksService,
          useValue: mockTracksService,
        },
      ],
    }).compile();

    searchService = module.get(SearchService);
  });

  describe('find', () => {
    it('aggregates results from all three services', async () => {
      const result = await searchService.find(userId, 'test');

      expect(result).toEqual({
        artists: artistSummaries,
        albums: albumSummaries,
        tracks: trackSummaries,
      });
    });

    it('delegates the query with the search filter and result limit', async () => {
      await searchService.find(userId, 'test');

      const expectedOptions = {
        filters: { search: 'test' },
        pagination: { limit: 10 },
      };

      expect(mockArtistsService.findAll).toHaveBeenCalledWith(
        userId,
        expectedOptions,
      );
      expect(mockAlbumsService.findAll).toHaveBeenCalledWith(
        userId,
        expectedOptions,
      );
      expect(mockTracksService.findAll).toHaveBeenCalledWith(
        userId,
        expectedOptions,
      );
    });

    it('trims the query before delegating', async () => {
      await searchService.find(userId, '  beatles  ');

      const [, options] = mockTracksService.findAll.mock.calls[0];
      expect(options).toMatchObject({ filters: { search: 'beatles' } });
    });

    it('returns empty results for a whitespace-only query without querying', async () => {
      const result = await searchService.find(userId, '   ');

      expect(result).toEqual({ artists: [], albums: [], tracks: [] });
      expect(mockArtistsService.findAll).not.toHaveBeenCalled();
      expect(mockAlbumsService.findAll).not.toHaveBeenCalled();
      expect(mockTracksService.findAll).not.toHaveBeenCalled();
    });
  });
});
