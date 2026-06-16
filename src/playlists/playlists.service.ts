import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlaylistTrack, PlaylistType } from '../../generated/prisma/client.js';
import {
  Playlist,
  playlistSelect,
  PlaylistSummary,
  playlistSummarySelect,
} from '../types/playlists.js';

@Injectable()
export class PlaylistsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<void> {
    await this.prisma.playlist.create({
      data: {
        ownerId: userId,
        name,
      },
      select: playlistSelect,
    });
  }

  async createLiked(userId: string): Promise<Playlist> {
    return this.prisma.playlist.create({
      data: { ownerId: userId, name: 'Liked Songs', type: PlaylistType.LIKED },
      select: playlistSelect,
    });
  }

  async find(id: string): Promise<Playlist | null> {
    return this.prisma.playlist.findUnique({
      where: { id },
      select: playlistSelect,
    });
  }

  async findLiked(userId: string): Promise<Playlist | null> {
    return this.prisma.playlist.findFirst({
      where: { ownerId: userId, type: PlaylistType.LIKED },
      select: playlistSelect,
    });
  }

  async findAll(userId: string): Promise<PlaylistSummary[]> {
    return this.prisma.playlist.findMany({
      where: { ownerId: userId },
      select: playlistSummarySelect,
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

    if (!playlist || playlist.ownerId !== userId) {
      throw new NotFoundException('Playlist not found');
    }

    const track = await this.prisma.track.findUnique({
      where: { id: trackId },
      select: { id: true },
    });

    if (!track) {
      throw new NotFoundException('Track not found');
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

    if (!playlist || playlist.ownerId !== userId) {
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

    if (!playlist || playlist.ownerId !== userId) {
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
    const playlistTrack = await this.findTrack(userId, id, trackId);

    if (!playlistTrack) {
      throw new NotFoundException('Track not found');
    }

    await this.prisma.playlistTrack.delete({
      where: { id: playlistTrack.id },
    });
  }
}
