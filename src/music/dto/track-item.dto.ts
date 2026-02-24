export interface ArtistDto {
  id: string;
  name: string;
}

export interface TrackAlbumDto {
  id: string;
  title: string;
}

export interface TrackItemDto {
  id: string;
  title: string;
  duration: number;
  album: TrackAlbumDto;
  artists: ArtistDto[];
}
