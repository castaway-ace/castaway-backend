export const buildAlbumIdentity = (
  title: string,
  albumArtistIds: string[],
): string => {
  const sortedIds = [...albumArtistIds].sort();
  return `${title}\u0000${sortedIds.join('\u0000')}`;
};
