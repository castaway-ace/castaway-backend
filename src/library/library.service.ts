import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistsService } from '../playlists/playlists.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { clampPagination } from '../common/query.js';
import {
  LibraryAlbumRow,
  LibraryArtistRow,
  LibraryItem,
  LibraryItemType,
  LibraryPlaylistRow,
  libraryAlbumSelect,
  libraryArtistSelect,
  libraryPlaylistSelect,
} from './library.types.js';

interface LibraryQueryOptions {
  pagination?: { limit?: number; offset?: number };
  /** Restricts the library to one entity type; omitted returns all three. */
  type?: LibraryItemType;
}

/** A merged row, tagged with the two fields the ordering is decided on. */
type Candidate =
  | {
      kind: LibraryItemType.PLAYLIST;
      sortName: string;
      lastInteractedAt: Date | null;
      raw: LibraryPlaylistRow;
    }
  | {
      kind: LibraryItemType.ALBUM;
      sortName: string;
      lastInteractedAt: Date | null;
      raw: LibraryAlbumRow;
    }
  | {
      kind: LibraryItemType.ARTIST;
      sortName: string;
      lastInteractedAt: Date | null;
      raw: LibraryArtistRow;
    };

/**
 * Orders the library: most recently interacted with first, then everything
 * untouched alphabetically.
 *
 * @remarks
 * The two buckets rank on different fields, so anything with a timestamp sorts
 * above everything without one rather than the two interleaving. Untouched
 * items have no recency to rank by and fall back to their name.
 */
const compareCandidates = (a: Candidate, b: Candidate): number => {
  if (a.lastInteractedAt && b.lastInteractedAt) {
    return b.lastInteractedAt.getTime() - a.lastInteractedAt.getTime();
  }
  if (a.lastInteractedAt) return -1;
  if (b.lastInteractedAt) return 1;
  return a.sortName.localeCompare(b.sortName);
};

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playlistService: PlaylistsService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
  ) {}

  /**
   * The user's library as one recency-ordered list: every playlist they own
   * (Liked Songs included), plus every album and artist they've starred.
   *
   * @remarks
   * Exists so a client can render the library from a single request. The three
   * entity types live in different tables with no shared ordering column, so
   * ranking them against each other can only happen after they're merged —
   * which is why the sort and the pagination window are both applied here in
   * memory rather than pushed into Prisma.
   *
   * Recency is joined per entity by {@link libraryPlaylistSelect} and friends,
   * so unlike the interactions feed this reports a real `lastInteractedAt` for
   * every item rather than only the most recent handful.
   *
   * Artwork is resolved only for the page being returned, and in two batched
   * lookups rather than per item.
   *
   * Filtering by `type` skips the other types' queries outright rather than
   * discarding their rows afterward. Everything below the fetch is already
   * type-agnostic, so a single-type library sorts and paginates unchanged.
   */
  async findAll(
    userId: string,
    options: LibraryQueryOptions = {},
  ): Promise<LibraryItem[]> {
    const includes = (kind: LibraryItemType) =>
      options.type === undefined || options.type === kind;

    const [playlists, albums, artists] = await Promise.all([
      includes(LibraryItemType.PLAYLIST)
        ? this.prisma.playlist.findMany({
            where: { ownerId: userId },
            select: libraryPlaylistSelect(userId),
          })
        : Promise.resolve<LibraryPlaylistRow[]>([]),
      includes(LibraryItemType.ALBUM)
        ? this.prisma.album.findMany({
            where: { albumAnnotations: { some: { userId, starred: true } } },
            select: libraryAlbumSelect(userId),
          })
        : Promise.resolve<LibraryAlbumRow[]>([]),
      includes(LibraryItemType.ARTIST)
        ? this.prisma.artist.findMany({
            where: { artistAnnotations: { some: { userId, starred: true } } },
            select: libraryArtistSelect(userId),
          })
        : Promise.resolve<LibraryArtistRow[]>([]),
    ]);

    const candidates: Candidate[] = [
      ...playlists.map((raw): Candidate => ({
        kind: LibraryItemType.PLAYLIST,
        sortName: raw.name,
        lastInteractedAt: raw.playlistInteractions[0]?.updatedAt ?? null,
        raw,
      })),
      ...albums.map((raw): Candidate => ({
        kind: LibraryItemType.ALBUM,
        sortName: raw.title,
        lastInteractedAt: raw.albumInteractions[0]?.updatedAt ?? null,
        raw,
      })),
      ...artists.map((raw): Candidate => ({
        kind: LibraryItemType.ARTIST,
        sortName: raw.name,
        lastInteractedAt: raw.artistInteractions[0]?.updatedAt ?? null,
        raw,
      })),
    ];

    candidates.sort(compareCandidates);

    const { take, skip } = clampPagination(options.pagination);
    const page = candidates.slice(skip, skip + take);

    return this.enrichWithArtwork(page);
  }

  /** Resolves each item's artwork in batched lookups, preserving order. */
  private async enrichWithArtwork(page: Candidate[]): Promise<LibraryItem[]> {
    const albumIds = page.flatMap((candidate) =>
      candidate.kind === LibraryItemType.ALBUM ? [candidate.raw.id] : [],
    );
    const artistIds = page.flatMap((candidate) =>
      candidate.kind === LibraryItemType.ARTIST ? [candidate.raw.id] : [],
    );
    const playlistIds = page.flatMap((candidate) =>
      candidate.kind === LibraryItemType.PLAYLIST ? [candidate.raw.id] : [],
    );

    const [albumCovers, artistImages, playlistCovers] = await Promise.all([
      albumIds.length
        ? this.albumService.findAlbumCoverMap(albumIds)
        : new Map<string, string>(),
      artistIds.length
        ? this.artistService.findArtistImageMap(artistIds)
        : new Map<string, string>(),
      playlistIds.length
        ? this.playlistService.findPlaylistCoverMap(playlistIds)
        : new Map<string, string[]>(),
    ]);

    return page.map((candidate): LibraryItem => {
      switch (candidate.kind) {
        case LibraryItemType.PLAYLIST: {
          const { id, name, type: playlistType } = candidate.raw;
          return {
            type: LibraryItemType.PLAYLIST,
            playlist: { id, name },
            coverUrls: playlistCovers.get(id) ?? [],
            playlistType,
            lastInteractedAt: candidate.lastInteractedAt,
          };
        }
        case LibraryItemType.ALBUM: {
          const { id, title, albumArtists } = candidate.raw;
          return {
            type: LibraryItemType.ALBUM,
            album: { id, title },
            artists: albumArtists.map((albumArtist) => albumArtist.artist),
            coverUrl: albumCovers.get(id) ?? null,
            lastInteractedAt: candidate.lastInteractedAt,
          };
        }
        case LibraryItemType.ARTIST: {
          const { id, name } = candidate.raw;
          return {
            type: LibraryItemType.ARTIST,
            artist: { id, name },
            coverUrl: artistImages.get(id) ?? null,
            lastInteractedAt: candidate.lastInteractedAt,
          };
        }
      }
    });
  }
}
