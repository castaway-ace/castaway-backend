import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Track } from '../../generated/prisma/client.js';

interface TrackFilters {
  artistIds?: string[];
  albumIds?: string[];
  genreIds?: string[];
  starred?: boolean;
}

interface TrackQueryOptions {
  filters?: TrackFilters;
  sort?: {
    field: 'name' | 'year' | 'added' | 'artist' | 'playCount';
    direction: 'asc' | 'desc';
  };
  pagination: { limit: number; offset: number };
  userId: string;
}

@Injectable()
export class TracksService {
  constructor(private readonly prisma: PrismaService) {}

  async findTracks(options?: TrackQueryOptions): Promise<Track[] | null> {
    return this.prisma.track.findMany({
      orderBy: {
        [options?.sort?.field as string]: options?.sort?.direction,
      },
    });
  }
}
