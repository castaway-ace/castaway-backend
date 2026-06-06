import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistTrack } from '../../generated/prisma/client.js';
import { TracksService } from '../tracks/tracks.service.js';
import { Playlist, PlaylistSummary } from '../types/playlists.js';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackService: TracksService,
  ) {}

  async create(userId: string, name: string): Promise<Playlist> {
    const lastPlaylist = await this.prisma.playlist.findFirst({
      where: { ownerId: userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = lastPlaylist ? lastPlaylist.position + 1 : 0;

    return this.prisma.playlist.create({
      data: {
        ownerId: userId,
        name,
        position: nextPosition,
      },
    });
  }

  async find(id: string): Promise<Playlist | null> {
    return this.prisma.playlist.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        public: true,
        position: true,
        ownerId: true,
        tracks: true,
      },
    });
  }

  async findAll(userId: string): Promise<PlaylistSummary[]> {
    return this.prisma.playlist.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        public: true,
        position: true,
        tracks: true,
      },
    });
  }

  async update(userId: string, id: string, name: string): Promise<void> {
    const result = await this.prisma.playlist.updateMany({
      where: { id, ownerId: userId },
      data: { name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.prisma.playlist.deleteMany({
      where: { id, ownerId: userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async addTrack(userId: string, id: string, trackId: string): Promise<void> {
    const playlist = await this.find(id);
    const track = await this.trackService.find(trackId);

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    if (!playlist || playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const lastPlaylist = await this.prisma.playlistTrack.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = lastPlaylist ? lastPlaylist.position + 1 : 0;

    await this.prisma.playlistTrack.create({
      data: {
        playlistId: playlist.id,
        trackId: track.id,
        position: nextPosition,
      },
    });
  }

  async findTracks(
    userId: string,
    playlistId: string,
  ): Promise<PlaylistTrack[]> {
    const playlist = await this.find(playlistId);

    if (!playlist || (!playlist.public && playlist.ownerId !== userId)) {
      throw new NotFoundException('Playlist not found');
    }

    return await this.prisma.playlistTrack.findMany({
      where: { playlistId: playlist.id },
      orderBy: { position: 'asc' },
    });
  }

  async findTrack(
    userId: string,
    playlistId: string,
    trackId: string,
  ): Promise<PlaylistTrack | null> {
    const playlist = await this.find(playlistId);

    if (!playlist || (!playlist.public && playlist.ownerId !== userId)) {
      throw new NotFoundException('Playlist not found');
    }

    return await this.prisma.playlistTrack.findFirst({
      where: { playlistId, id: trackId },
    });
  }

  async deleteTrack(
    userId: string,
    id: string,
    trackId: string,
  ): Promise<void> {
    const playlist = await this.find(id);

    const playlistTrack = await this.findTrack(id, userId, trackId);

    if (!playlist || playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    if (!playlistTrack) {
      throw new NotFoundException('Track not found');
    }

    await this.prisma.playlistTrack.delete({
      where: { id: playlistTrack.id },
    });
  }
}
