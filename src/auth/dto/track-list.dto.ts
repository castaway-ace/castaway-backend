import { Prisma } from '../../generated/prisma/client.js';

type TrackWithRelations = Prisma.TrackGetPayload<{
  select: {
    id: true;
    title: true;
    duration: true;
    artists: {
      select: {
        order: true;
        artist: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    album: {
      select: {
        id: true;
        title: true;
      };
    };
  };
}>;

export class TrackListItemDto {
  id: string;
  title: string;
  duration: number;
  artistName: string;
  albumId: string;
  albumTitle: string;

  constructor(track: TrackWithRelations) {
    this.id = track.id;
    this.title = track.title;
    this.duration = track.duration || 0;
    this.artistName = track.artists[0]?.artist?.name || 'Unknown Artist';
    this.albumId = track.album.id;
    this.albumTitle = track.album.title;
  }
}
