import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LibraryRepository } from './library.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { formatTrackResponse } from '../common/formatters/track.formatter.js';
import { MusicRepository } from '../music/music.repository.js';

@Injectable()
export class LibraryService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly musicRepository: MusicRepository,
  ) {}

  /**
   * Add track to user library
   */
  async addToLibrary(userId: string, trackId: string) {
    const track = await this.musicRepository.findTrackById(trackId);

    if (!track) {
      throw new NotFoundException(`Track with ID ${trackId} not found`);
    }

    try {
      await this.libraryRepository.addToLibrary(userId, trackId);
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
      await this.libraryRepository.removeFromLibrary(userId, trackId);
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
    const libraryEntries = await this.libraryRepository.getLibraryTracks(
      userId,
      {
        take: options?.limit,
        skip: options?.offset,
      },
    );

    return libraryEntries.map((entry) => ({
      addedAt: entry.addedAt,
      track: formatTrackResponse(entry.track),
    }));
  }

  /**
   * Get distinct artists from user library
   */
  async getLibraryArtists(userId: string) {
    const artists = await this.libraryRepository.getLibraryArtists(userId);

    return artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
    }));
  }

  /**
   * Get distinct albums from user library
   */
  async getLibraryAlbums(userId: string) {
    const albums = await this.libraryRepository.getLibraryAlbums(userId);

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
}
