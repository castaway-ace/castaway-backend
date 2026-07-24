import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsService } from '../artists/artists.service.js';
import { AlbumsService } from '../albums/albums.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildAlbumIdentity } from '../common/album-identity.js';
import {
  AlbumImportPlan,
  ParsedTrackInput,
  TrackImportPlan,
} from './ingest.types.js';

const IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;

export interface PlanAlbumOptions {
  /** Deterministic album id (e.g. the worker's session id) for idempotency. */
  albumId?: string;
}

/**
 * Source-agnostic album ingest: validates parsed tracks, resolves artists,
 * computes the object keys/rows to write (`planAlbum`), and persists the album
 * in a single transaction (`persistImport`). Shared by the synchronous admin
 * upload path and the async worker so both apply identical rules.
 */
@Injectable()
export class IngestService {
  constructor(
    private readonly trackService: TracksService,
    private readonly artistService: ArtistsService,
    private readonly albumService: AlbumsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validates the upload, resolves artists, and produces the set of object keys
   * and DB rows to write. Pure planning: no storage or DB writes. Errors match
   * the previous synchronous behavior exactly (missing artists, multi-album and
   * duplicate-position payloads, and the already-imported conflict).
   */
  async planAlbum(
    parsedFiles: ParsedTrackInput[],
    options: PlanAlbumOptions = {},
  ): Promise<AlbumImportPlan> {
    const artistMap = await this.resolveArtistMap(parsedFiles);
    this.validateSingleAlbum(parsedFiles, artistMap);
    this.validateUniqueTrackPositions(parsedFiles);

    const firstTags = parsedFiles[0].tags;
    const albumArtistIds = this.resolveArtistIds(
      firstTags.albumArtistNames,
      artistMap,
    );

    const identityKey = await this.albumService.assertNotImported(
      firstTags.albumTitle,
      albumArtistIds,
    );

    const albumId = options.albumId ?? randomUUID();

    const cover = firstTags.picture;
    const hasCover = cover !== undefined && cover.format.startsWith('image/');
    const coverKey = hasCover ? this.albumService.buildCoverKey(albumId) : null;

    const tracks: TrackImportPlan[] = parsedFiles.map((parsed) => ({
      tags: parsed.tags,
      suffix: parsed.suffix,
      size: parsed.size,
      fileKey: this.trackService.buildFileKey(
        albumId,
        parsed.tags,
        parsed.suffix,
      ),
      trackArtistIds: this.resolveArtistIds(
        parsed.tags.trackArtistNames,
        artistMap,
      ),
    }));

    return {
      albumId,
      identityKey,
      albumTitle: firstTags.albumTitle,
      releaseDate: firstTags.date,
      albumArtistIds,
      coverKey,
      cover: hasCover ? cover : undefined,
      tracks,
    };
  }

  /**
   * Persists the album and its tracks in a single transaction. If the write
   * fails, the already-uploaded objects are removed before rethrowing.
   */
  async persistImport(plan: AlbumImportPlan): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.albumService.create(
            {
              id: plan.albumId,
              title: plan.albumTitle,
              releaseDate: plan.releaseDate,
              identityKey: plan.identityKey,
              imageKey: plan.coverKey,
              artistIds: plan.albumArtistIds,
            },
            tx,
          );

          for (const track of plan.tracks) {
            await this.trackService.create(
              {
                title: track.tags.title,
                albumId: plan.albumId,
                fileKey: track.fileKey,
                trackNumber: track.tags.trackNumber,
                discNumber: track.tags.discNumber,
                duration: track.tags.duration,
                size: track.size,
                suffix: track.suffix,
                genres: track.tags.genres,
                bitRate: track.tags.bitRate,
                sampleRate: track.tags.sampleRate,
                bitDepth: track.tags.bitDepth,
                releaseDate: track.tags.date,
                artistIds: track.trackArtistIds,
              },
              tx,
            );
          }
        },
        {
          timeout: IMPORT_TRANSACTION_TIMEOUT_MS,
          maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS,
        },
      );
    } catch (error) {
      await this.cleanupObjects(
        plan.tracks.map((track) => track.fileKey),
        plan.coverKey,
      );
      throw error;
    }
  }

  /** Removes uploaded track objects and the cover (rollback / abort paths). */
  async cleanupObjects(
    trackKeys: string[],
    coverKey: string | null,
  ): Promise<void> {
    await this.trackService.deleteTrackObjects(trackKeys);
    if (coverKey) {
      await this.albumService.deleteCoverObject(coverKey);
    }
  }

  private async resolveArtistMap(
    parsedFiles: ParsedTrackInput[],
  ): Promise<Map<string, string>> {
    const names = new Set<string>();
    for (const { tags } of parsedFiles) {
      for (const name of tags.albumArtistNames) names.add(name);
      for (const name of tags.trackArtistNames) names.add(name);
    }

    const found = await this.artistService.findIdsByNames([...names]);

    const missing = [...names].filter((name) => !found.has(name));
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `${missing.length} artist(s) must be created before uploading`,
        missingArtists: missing,
      });
    }

    return found;
  }

  private resolveArtistIds(
    names: string[],
    artistMap: Map<string, string>,
  ): string[] {
    return names.map((name) => {
      const id = artistMap.get(name);
      if (!id) {
        throw new BadRequestException(`Artist could not be resolved: ${name}`);
      }
      return id;
    });
  }

  private validateSingleAlbum(
    parsedFiles: ParsedTrackInput[],
    artistMap: Map<string, string>,
  ): void {
    const identities = new Set(
      parsedFiles.map(({ tags }) => {
        const albumArtistIds = this.resolveArtistIds(
          tags.albumArtistNames,
          artistMap,
        );
        return buildAlbumIdentity(tags.albumTitle, albumArtistIds);
      }),
    );

    if (identities.size > 1) {
      const found = [
        ...new Set(
          parsedFiles.map(
            ({ tags }) =>
              `"${tags.albumTitle}" by ${tags.albumArtistNames.join(', ')}`,
          ),
        ),
      ];
      throw new BadRequestException({
        message: 'Upload must contain tracks from a single album',
        foundAlbums: found,
      });
    }
  }

  private validateUniqueTrackPositions(parsedFiles: ParsedTrackInput[]): void {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const { tags } of parsedFiles) {
      const key = `${tags.discNumber}-${tags.trackNumber}`;
      const existingTitle = seen.get(key);
      if (existingTitle !== undefined) {
        collisions.push(
          `Disc ${tags.discNumber}, track ${tags.trackNumber}: "${existingTitle}" and "${tags.title}"`,
        );
      } else {
        seen.set(key, tags.title);
      }
    }

    if (collisions.length > 0) {
      throw new BadRequestException({
        message: 'Upload contains duplicate disc and track numbers',
        collisions,
      });
    }
  }
}
