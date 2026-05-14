import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Playlist, PlaylistTrack } from '../../generated/prisma/client.js';
import { TracksService } from '../tracks/tracks.service.js';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackService: TracksService,
  ) {}

  async createPlaylist(name: string, userId: string): Promise<Playlist> {
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

  async findPlaylist(id: string): Promise<Playlist | null> {
    return this.prisma.playlist.findUnique({
      where: { id },
    });
  }

  async findPlaylists(userId: string): Promise<Playlist[]> {
    return this.prisma.playlist.findMany({
      where: { ownerId: userId },
    });
  }

  async updatePlaylist(
    id: string,
    userId: string,
    name: string,
  ): Promise<void> {
    const result = await this.prisma.playlist.updateMany({
      where: { id, ownerId: userId },
      data: { name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async deletePlaylist(id: string, userId: string): Promise<void> {
    const result = await this.prisma.playlist.deleteMany({
      where: { id, ownerId: userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Playlist not found');
    }
  }

  async addPlaylistTrack(
    id: string,
    userId: string,
    trackId: string,
  ): Promise<void> {
    const playlist = await this.findPlaylist(id);
    const track = await this.trackService.findTrack(trackId);

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

  async getPlaylistTracks(
    playlistId: string,
    userId: string,
  ): Promise<PlaylistTrack[]> {
    const playlist = await this.findPlaylist(playlistId);

    if (!playlist || (!playlist.public && playlist.ownerId !== userId)) {
      throw new NotFoundException('Playlist not found');
    }

    return await this.prisma.playlistTrack.findMany({
      where: { playlistId: playlist.id },
      orderBy: { position: 'asc' },
    });
  }

  async getPlaylistTrack(
    playlistId: string,
    userId: string,
    trackId: string,
  ): Promise<PlaylistTrack | null> {
    const playlist = await this.findPlaylist(playlistId);

    if (!playlist || (!playlist.public && playlist.ownerId !== userId)) {
      throw new NotFoundException('Playlist not found');
    }

    return await this.prisma.playlistTrack.findFirst({
      where: { playlistId, id: trackId },
    });
  }

  async deletePlaylistTrack(
    id: string,
    userId: string,
    trackId: string,
  ): Promise<void> {
    const playlist = await this.findPlaylist(id);

    const playlistTrack = await this.getPlaylistTrack(id, userId, trackId);

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
