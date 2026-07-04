export function buildAlbumIdentity(
  title: string,
  albumArtistIds: string[],
): string {
  const sortedIds = [...albumArtistIds].sort();
  return [title, ...sortedIds].join('|');
}
