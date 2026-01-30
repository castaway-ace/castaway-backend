import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpStatus,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service.js';
import { type Response } from 'express';
import * as mm from 'music-metadata';
import { createHash } from 'crypto';
import { Prisma } from '../generated/prisma/client.js';
import { MusicRepository } from './music.repository.js';
import {
  AlbumUploadResult,
  ExtractedMetadata,
  TrackFilter,
  TrackWithRelations,
  UploadResult,
} from './music.types.js';
import { StorageUploadResult } from '../storage/storage.types.js';

@Injectable()
export class MusicService {
  private readonly TRACK_PREFIX = 'tracks/';
  private readonly ALBUM_ART_PREFIX = 'album-art/';
  private readonly logger = new Logger(MusicService.name);

  constructor(
    private storage: StorageService,
    private readonly musicRepository: MusicRepository,
  ) {}

  // ==================== UPLOAD ====================

  /**
   * Upload a track with automatic metadata extraction and storage
   */
  async uploadTrack(file: Express.Multer.File): Promise<UploadResult> {
    // Step 1: Calculate checksum
    const checksum = this.calculateChecksum(file.buffer);

    const existingFile =
      await this.musicRepository.findAudioFileByChecksum(checksum);

    if (existingFile) {
      throw new ConflictException(
        `This exact file already exists as track: ${existingFile.track.title}`,
      );
    }

    // Step 3: Extract metadata
    const metadata = await this.extractMetadata(file.buffer, file.mimetype);

    // Step 4: Check for metadata-based duplicates
    const potentialDuplicate = await this.findMetadataDuplicate(metadata);

    if (potentialDuplicate) {
      console.warn(
        `Potential duplicate found: ${metadata.title} by ${metadata.artists.join(', ')}`,
      );
    }

    const storageKey = `${this.TRACK_PREFIX}${checksum}.${metadata.format}`;

    // Step 5: Upload audio file to MinIO
    const audioUpload: StorageUploadResult = await this.storage.uploadFile(
      storageKey,
      file.buffer,
      file.mimetype,
      {
        title: metadata.title,
        artist: metadata.artists.join(', '),
        album: metadata.album,
      },
    );

    // Step 6: Handle album art if present
    let albumArtKey: string | undefined;
    if (metadata.picture) {
      const artUpload = await this.uploadAlbumArt(metadata.picture);
      albumArtKey = artUpload.storageKey;
    }

    // Step 7: Create database records (transaction)
    const track = await this.musicRepository.createTrackWithRelations({
      metadata: {
        title: metadata.title,
        album: metadata.album,
        albumArtist: metadata.albumArtist,
        artists: metadata.artists,
        trackNumber: metadata.trackNumber,
        discNumber: metadata.discNumber,
        releaseYear: metadata.releaseYear,
        genre: metadata.genre,
        duration: metadata.duration,
        format: metadata.format,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
      },
      audioKey: audioUpload.storageKey,
      albumArtKey,
      checksum,
      fileSize: audioUpload.size,
    });

    return {
      trackId: track.id,
      duplicate: !!potentialDuplicate,
      message: potentialDuplicate
        ? 'Uploaded successfully, but similar track exists'
        : 'Uploaded successfully',
    };
  }

  /**
   * Upload multiple tracks as an album
   */
  async uploadAlbum(files: Express.Multer.File[]): Promise<AlbumUploadResult> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results: string[] = [];
    const duplicates: string[] = [];
    const failures: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const result = await this.uploadTrack(file);
        results.push(result.trackId);
        if (result.duplicate) {
          duplicates.push(file.originalname);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        failures.push({
          filename: file.originalname,
          error: errorMessage,
        });
        this.logger.error(
          `Failed to upload ${file.originalname}: ${errorMessage}`,
        );
      }
    }

    return {
      trackIds: results,
      duplicates,
      failures,
      message: `Uploaded ${results.length} tracks. ${duplicates.length} duplicates detected. ${failures.length} failures.`,
    };
  }

  // ==================== TRACKS ====================

  /**
   * Get tracks with optional filtering
   */
  async getTracks(filter: TrackFilter) {
    const where: Prisma.TrackWhereInput = {};

    // Filter by artist name
    if (filter.artist) {
      where.artists = {
        some: {
          artist: {
            name: {
              contains: filter.artist,
              mode: 'insensitive',
            },
          },
        },
      };
    }

    // Filter by album title
    if (filter.album) {
      where.album = {
        title: {
          contains: filter.album,
          mode: 'insensitive',
        },
      };
    }

    const tracks = await this.musicRepository.findTracks(where, {
      take: filter.limit,
      skip: filter.offset,
    });

    // Transform to clean response format
    return tracks.map((track) => {
      // Sort artists by order in application code
      const sortedArtists = [...track.artists].sort(
        (a, b) => a.order - b.order,
      );
      return {
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        duration: track.duration,
        artists: sortedArtists.map((ta) => ({
          id: ta.artist.id,
          name: ta.artist.name,
        })),
        album: {
          id: track.album.id,
          title: track.album.title,
          releaseYear: track.album.releaseYear,
          genre: track.album.genre,
          albumArtKey: track.album.albumArtKey,
          artist: {
            id: track.album.artist.id,
            name: track.album.artist.name,
          },
        },
        audioFile: track.audioFile
          ? {
              storageKey: track.audioFile.storageKey,
              format: track.audioFile.format,
              bitrate: track.audioFile.bitrate,
              sampleRate: track.audioFile.sampleRate,
              fileSize: track.audioFile.fileSize.toString(),
            }
          : null,
      };
    });
  }

  /**
   * Get a single track by ID
   */
  async getTrack(id: string) {
    const track = await this.musicRepository.findTrackById(id);

    if (!track) {
      throw new NotFoundException(`Track with ID ${id} not found`);
    }

    // Sort artists by order in application code
    const sortedArtists = [...track.artists].sort((a, b) => a.order - b.order);

    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      duration: track.duration,
      artists: sortedArtists.map((ta) => ({
        id: ta.artist.id,
        name: ta.artist.name,
      })),
      album: {
        id: track.album.id,
        title: track.album.title,
        releaseYear: track.album.releaseYear,
        genre: track.album.genre,
        albumArtKey: track.album.albumArtKey,
        artist: {
          id: track.album.artist.id,
          name: track.album.artist.name,
        },
      },
      audioFile: track.audioFile
        ? {
            storageKey: track.audioFile.storageKey,
            format: track.audioFile.format,
            bitrate: track.audioFile.bitrate,
            sampleRate: track.audioFile.sampleRate,
            fileSize: track.audioFile.fileSize.toString(),
          }
        : null,
    };
  }

  // ==================== ARTISTS ====================

  async getArtists() {
    const artists = await this.musicRepository.findAllArtists();

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      albumCount: artist.albums.length,
      trackCount: artist.tracks.length,
    }));
  }

  /**
   * Get all albums by an artist
   */
  async getArtistAlbums(artistId: string) {
    const artist = await this.musicRepository.findArtistById(artistId);

    if (!artist) {
      throw new NotFoundException(`Artist with ID ${artistId} not found`);
    }

    return {
      id: artist.id,
      name: artist.name,
      albums: artist.albums.map((album) => ({
        id: album.id,
        title: album.title,
        releaseYear: album.releaseYear,
        genre: album.genre,
        albumArtKey: album.albumArtKey,
        trackCount: album.tracks.length,
        totalDuration: album.tracks.reduce(
          (sum, track) => sum + (track.duration || 0),
          0,
        ),
      })),
    };
  }

  // ==================== ALBUMS ====================

  /**
   * Get all tracks in an album
   */
  async getAlbumTracks(albumId: string) {
    const album = await this.musicRepository.findAlbumWithTracks(albumId);

    if (!album) {
      throw new NotFoundException(`Album with ID ${albumId} not found`);
    }

    return {
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
      tracks: album.tracks.map((track) => {
        // Sort artists by order in application code
        const sortedArtists = [...track.artists].sort(
          (a, b) => a.order - b.order,
        );

        return {
          id: track.id,
          title: track.title,
          trackNumber: track.trackNumber,
          discNumber: track.discNumber,
          duration: track.duration,
          artists: sortedArtists.map((ta) => ({
            id: ta.artist.id,
            name: ta.artist.name,
          })),
          audioFile: track.audioFile
            ? {
                storageKey: track.audioFile.storageKey,
                format: track.audioFile.format,
                bitrate: track.audioFile.bitrate,
                sampleRate: track.audioFile.sampleRate,
                fileSize: track.audioFile.fileSize.toString(),
              }
            : null,
        };
      }),
    };
  }

  /**
   * Get album art key
   */
  async getAlbumArtKey(albumId: string): Promise<string | null> {
    const album = await this.musicRepository.findAlbumById(albumId, {
      select: { id: true, albumArtKey: true },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return album.albumArtKey;
  }

  // ==================== PLAYLISTS ====================

  /**
   * Get all playlists for a user
   */
  async getPlaylists(userId: string) {
    const playlists = await this.musicRepository.findAllPlaylists(userId);

    return playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      coverImage: playlist.coverImage,
      trackCount: playlist.tracks.length,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    }));
  }

  /**
   * Get a single playlist with tracks
   */
  async getPlaylist(playlistId: string, userId: string) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    // Check if user has access (owner or public)
    if (playlist.userId !== userId && !playlist.isPublic) {
      throw new ForbiddenException('You do not have access to this playlist');
    }

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      coverImage: playlist.coverImage,
      owner: {
        id: playlist.user.id,
        name: playlist.user.name,
        email: playlist.user.email,
      },
      tracks: playlist.tracks.map((pt) => ({
        playlistTrackId: pt.id,
        position: pt.position,
        addedAt: pt.addedAt,
        track: this.formatTrackResponse(pt.track),
      })),
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(
    userId: string,
    data: {
      name: string;
      description?: string;
      isPublic?: boolean;
    },
  ) {
    const playlist = await this.musicRepository.createPlaylist({
      userId,
      name: data.name,
      description: data.description,
      isPublic: data.isPublic,
    });

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      createdAt: playlist.createdAt,
    };
  }

  /**
   * Update playlist metadata
   */
  async updatePlaylist(
    playlistId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      coverImage?: string;
    },
  ) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this playlist',
      );
    }

    const updated = await this.musicRepository.updatePlaylist(playlistId, data);

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isPublic: updated.isPublic,
      coverImage: updated.coverImage,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(playlistId: string, userId: string) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this playlist',
      );
    }

    await this.musicRepository.deletePlaylist(playlistId);

    return {
      message: 'Playlist deleted successfully',
    };
  }

  /**
   * Add tracks to playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    userId: string,
    trackIds: string[],
  ) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.musicRepository.addTracksToPlaylist(playlistId, trackIds);

    return {
      message: `Added ${trackIds.length} tracks to playlist`,
    };
  }

  /**
   * Remove track from playlist
   */
  async removeTrackFromPlaylist(
    playlistId: string,
    trackId: string,
    userId: string,
  ) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.musicRepository.removeTrackFromPlaylist(playlistId, trackId);

    return {
      message: 'Track removed from playlist',
    };
  }

  /**
   * Reorder tracks in a playlist
   */
  async reorderPlaylistTracks(
    playlistId: string,
    userId: string,
    updates: Array<{ id: string; position: number }>,
  ) {
    const playlist = await this.musicRepository.findPlaylistById(playlistId);

    if (!playlist) {
      throw new NotFoundException(`Playlist with ID ${playlistId} not found`);
    }

    if (playlist.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this playlist',
      );
    }

    await this.musicRepository.reorderPlaylistTracks(updates);

    return {
      message: 'Playlist tracks reordered successfully',
    };
  }

  // ==================== USER LIBRARY ====================

  /**
   * Add track to user library
   */
  async addToLibrary(userId: string, trackId: string) {
    const track = await this.musicRepository.findTrackById(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    try {
      await this.musicRepository.addToLibrary(userId, trackId);
      return {
        message: 'Track added to library',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Track already in library');
        }
      }
      throw error;
    }
  }

  /**
   * Remove track from user library
   */
  async removeFromLibrary(userId: string, trackId: string) {
    try {
      await this.musicRepository.removeFromLibrary(userId, trackId);
      return {
        message: 'Track removed from library',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Track not found in library');
        }
      }
      throw error;
    }
  }

  /**
   * Get all tracks in user library
   */
  async getLibraryTracks(
    userId: string,
    options?: { limit?: number; offset?: number },
  ) {
    const libraryEntries = await this.musicRepository.getLibraryTracks(userId, {
      take: options?.limit,
      skip: options?.offset,
    });

    return libraryEntries.map((entry) => ({
      addedAt: entry.addedAt,
      track: this.formatTrackResponse(entry.track),
    }));
  }

  /**
   * Get distinct artists from user library
   */
  async getLibraryArtists(userId: string) {
    const artists = await this.musicRepository.getLibraryArtists(userId);

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
    }));
  }

  /**
   * Get distinct albums from user library
   */
  async getLibraryAlbums(userId: string) {
    const albums = await this.musicRepository.getLibraryAlbums(userId);

    return albums.map((album) => ({
      id: album.id,
      title: album.title,
      releaseYear: album.releaseYear,
      genre: album.genre,
      albumArtKey: album.albumArtKey,
      artist: {
        id: album.artist.id,
        name: album.artist.name,
      },
    }));
  }

  // ==================== LISTENING HISTORY ====================

  /**
   * Record a track play
   */
  async recordPlay(userId: string, trackId: string, duration?: number) {
    const track = await this.musicRepository.findTrackById(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    // Record in history
    await this.musicRepository.recordPlay(userId, trackId, duration);

    // Update track play statistics
    await this.musicRepository.updateTrackPlayStats(trackId);

    return {
      message: 'Play recorded',
    };
  }

  /**
   * Get recent plays for user
   */
  async getRecentPlays(userId: string, limit?: number) {
    const history = await this.musicRepository.getRecentPlays(
      userId,
      limit || 50,
    );

    return history.map((entry) => ({
      playedAt: entry.playedAt,
      duration: entry.duration,
      track: this.formatTrackResponse(entry.track),
    }));
  }

  /**
   * Get play statistics for a track
   */
  async getTrackStats(trackId: string) {
    const stats = await this.musicRepository.getTrackStats(trackId);

    return {
      trackId: stats.trackId,
      playCount: stats.playCount,
      lastPlayedAt: stats.lastPlayedAt,
      totalPlays: stats.historyCount,
    };
  }

  // ==================== QUEUE ====================

  /**
   * Get user queue
   */
  async getQueue(userId: string) {
    const queue = await this.musicRepository.getOrCreateQueue(userId);

    return {
      currentTrack: queue.currentTrack
        ? this.formatTrackResponse(queue.currentTrack)
        : null,
      position: queue.position,
      shuffleEnabled: queue.shuffleEnabled,
      repeatMode: queue.repeatMode,
      items: queue.queueItems.map(
        (item: {
          id: string;
          position: number;
          track: TrackWithRelations;
        }) => ({
          id: item.id,
          position: item.position,
          track: this.formatTrackResponse(item.track),
        }),
      ),
    };
  }

  /**
   * Set queue from source (playlist, album, or track list)
   */
  async setQueue(userId: string, trackIds: string[], currentTrackId?: string) {
    await this.musicRepository.setQueueItems(userId, trackIds);

    if (currentTrackId) {
      await this.musicRepository.updateQueue(userId, {
        currentTrackId,
        position: 0,
      });
    }

    return {
      message: 'Queue set successfully',
    };
  }

  /**
   * Update queue state
   */
  async updateQueue(
    userId: string,
    data: {
      currentTrackId?: string;
      position?: number;
      shuffleEnabled?: boolean;
      repeatMode?: 'OFF' | 'ONE' | 'ALL';
    },
  ) {
    await this.musicRepository.updateQueue(userId, data);

    return {
      message: 'Queue updated',
    };
  }

  /**
   * Add tracks to queue
   */
  async addToQueue(userId: string, trackIds: string[]) {
    await this.musicRepository.addToQueue(userId, trackIds);

    return {
      message: `Added ${trackIds.length} tracks to queue`,
    };
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(itemId: string) {
    await this.musicRepository.removeFromQueue(itemId);

    return {
      message: 'Item removed from queue',
    };
  }

  /**
   * Reorder queue items
   */
  async reorderQueue(updates: Array<{ id: string; position: number }>) {
    await this.musicRepository.reorderQueue(updates);

    return {
      message: 'Queue reordered successfully',
    };
  }

  // ==================== SEARCH ====================

  /**
   * Search tracks, artists, and albums
   */
  async search(query: string, type: 'all' | 'track' | 'artist' | 'album') {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const results = await this.musicRepository.search(query, type);

    const response: {
      tracks?: unknown[];
      artists?: unknown[];
      albums?: unknown[];
    } = {};

    if ('tracks' in results && results.tracks) {
      response.tracks = results.tracks.map((track) =>
        this.formatTrackResponse(track),
      );
    }

    if ('artists' in results && results.artists) {
      response.artists = results.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        albumCount: artist.albums.length,
        trackCount: artist.tracks.length,
      }));
    }

    if ('albums' in results && results.albums) {
      response.albums = results.albums.map((album) => ({
        id: album.id,
        title: album.title,
        releaseYear: album.releaseYear,
        genre: album.genre,
        albumArtKey: album.albumArtKey,
        trackCount: album.tracks.length,
        artist: {
          id: album.artist.id,
          name: album.artist.name,
        },
      }));
    }

    return response;
  }

  // ==================== STREAMING ====================

  /**
   * Stream a track (audio file)
   */
  async streamTrack(
    storageKey: string,
    range: string | undefined,
    res: Response,
  ): Promise<void> {
    try {
      const stats = await this.storage.getFileStats(storageKey);

      const contentType = this.getContentType(stats.metaData, 'audio/mpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunkSize = end - start + 1;

        if (start >= stats.size || end >= stats.size) {
          res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
          res.setHeader('Content-Range', `bytes */${stats.size}`);
          res.end();
          return;
        }

        res.status(HttpStatus.PARTIAL_CONTENT);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', chunkSize);

        this.logger.log(
          `Streaming ${storageKey} [${start}-${end}/${stats.size}]`,
        );

        const fileStream = await this.storage.getFileRange(
          storageKey,
          start,
          chunkSize,
        );

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      } else {
        res.setHeader('Content-Length', stats.size);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${storageKey}"`,
        );

        this.logger.log(
          `Streaming ${storageKey} [full file: ${stats.size} bytes]`,
        );

        const fileStream = await this.storage.getFile(storageKey);

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          this.logger.error(`Stream error for ${storageKey}: ${error.message}`);
          if (!res.headersSent) {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
              message: 'Stream error',
            });
          }
        });
      }
    } catch (error) {
      this.handleStreamError(error, res);
    }
  }

  /**
   * Stream an image (album art)
   */
  async streamImage(storageKey: string, res: Response): Promise<void> {
    try {
      const stats = await this.storage.getFileStats(storageKey);

      const contentType = this.getContentType(stats.metaData, 'image/jpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      this.logger.log(`Streaming image: ${storageKey}`);

      const fileStream = await this.storage.getFile(storageKey);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        this.logger.error(
          `Stream error for image ${storageKey}: ${error.message}`,
        );
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: 'Stream error',
          });
        }
      });
    } catch (error) {
      this.handleStreamError(error, res);
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Calculate SHA-256 checksum of a file buffer
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Extract metadata from audio file buffer
   */
  private async extractMetadata(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ExtractedMetadata> {
    const metadata = await mm.parseBuffer(buffer, { mimeType });

    const common = metadata.common;

    return {
      title: common.title || 'Unknown Title',
      album: common.album || 'Unknown Album',
      artists: this.parseArtists(common.artist, common.artists),
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      trackNumber: common.track?.no ?? null,
      discNumber: common.disk?.no ?? null,
      releaseYear: common.year ?? null,
      genre: common.genre?.[0] ?? null,
      duration: Math.floor(metadata.format.duration || 0),
      format: metadata.format.container || 'unknown',
      bitrate: metadata.format.bitrate ?? null,
      sampleRate: metadata.format.sampleRate ?? null,
      picture: common.picture?.[0],
    };
  }

  /**
   * Parse artist string into array, handling multiple artists
   */
  private parseArtists(artist?: string, artists?: string[]): string[] {
    if (artists && artists.length > 0) {
      return artists;
    }

    if (artist) {
      // Split on common separators
      const separators = [' & ', ' and ', ' feat. ', ' ft. ', ', '];
      let result = [artist];

      for (const sep of separators) {
        result = result.flatMap((a) => a.split(sep));
      }

      return result.map((a) => a.trim()).filter((a) => a.length > 0);
    }

    return ['Unknown Artist'];
  }

  /**
   * Upload album art to storage with deduplication
   */
  private async uploadAlbumArt(picture: mm.IPicture) {
    const imageBuffer = Buffer.from(picture.data);

    const artChecksum = createHash('sha256')
      .update(imageBuffer)
      .digest('hex')
      .substring(0, 16);

    const extension = picture.format.split('/')[1] || 'jpg';

    const storageKey = `${this.ALBUM_ART_PREFIX}${artChecksum}.${extension}`;

    return await this.storage.uploadFile(
      storageKey,
      imageBuffer,
      picture.format,
    );
  }

  /**
   * Find potential duplicate based on metadata (same title, album, artists)
   */
  private async findMetadataDuplicate(metadata: {
    title: string;
    album: string;
    artists: string[];
  }) {
    const tracks = await this.musicRepository.findTracksByMetadata(
      metadata.title,
      metadata.album,
    );

    for (const track of tracks) {
      const trackArtists = track.artists.map((ta) => ta.artist.name).sort();
      const newArtists = [...metadata.artists].sort();

      if (JSON.stringify(trackArtists) === JSON.stringify(newArtists)) {
        return track;
      }
    }

    return null;
  }

  /**
   * Format track response with consistent structure
   */
  private formatTrackResponse(track: {
    id: string;
    title: string;
    trackNumber: number | null;
    discNumber: number | null;
    duration: number | null;
    artists: Array<{
      order: number;
      artist: {
        id: string;
        name: string;
      };
    }>;
    album: {
      id: string;
      title: string;
      releaseYear: number | null;
      genre: string | null;
      albumArtKey: string | null;
      artist: {
        id: string;
        name: string;
      };
    };
    audioFile?: {
      storageKey: string;
      format: string;
      bitrate: number | null;
      sampleRate: number | null;
      fileSize: bigint;
    } | null;
  }) {
    const sortedArtists = [...track.artists].sort((a, b) => a.order - b.order);

    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber,
      duration: track.duration,
      artists: sortedArtists.map((ta) => ({
        id: ta.artist.id,
        name: ta.artist.name,
      })),
      album: {
        id: track.album.id,
        title: track.album.title,
        releaseYear: track.album.releaseYear,
        genre: track.album.genre,
        albumArtKey: track.album.albumArtKey,
        artist: {
          id: track.album.artist.id,
          name: track.album.artist.name,
        },
      },
      audioFile: track.audioFile
        ? {
            storageKey: track.audioFile.storageKey,
            format: track.audioFile.format,
            bitrate: track.audioFile.bitrate,
            sampleRate: track.audioFile.sampleRate,
            fileSize: track.audioFile.fileSize.toString(),
          }
        : null,
    };
  }

  private getContentType(
    metaData: Record<string, any>,
    defaultType: string,
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const contentType = metaData['content-type'];
    if (typeof contentType === 'string') {
      return contentType;
    }
    return defaultType;
  }

  private handleStreamError(error: unknown, res: Response): void {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Streaming failed: ${errorMessage}`);

    if (!res.headersSent) {
      if (error instanceof NotFoundException) {
        res.status(HttpStatus.NOT_FOUND).json({
          message: 'File not found',
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'Streaming failed',
          error: errorMessage,
        });
      }
    }
  }
}
