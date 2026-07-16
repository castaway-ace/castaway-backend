import { VARIOUS_ARTISTS_NAME } from './constants.js';
import { isVariousArtistName, toArtistRef } from './artist-ref.js';

describe('artist-ref', () => {
  describe('isVariousArtistName', () => {
    it('is true only for the canonical "Various Artists" name', () => {
      expect(isVariousArtistName(VARIOUS_ARTISTS_NAME)).toBe(true);
      expect(isVariousArtistName('Radiohead')).toBe(false);
      expect(isVariousArtistName('various artists')).toBe(false);
    });
  });

  describe('toArtistRef', () => {
    it('flags the synthetic "Various Artists" credit', () => {
      expect(toArtistRef({ id: 'va', name: VARIOUS_ARTISTS_NAME })).toEqual({
        id: 'va',
        name: VARIOUS_ARTISTS_NAME,
        isVarious: true,
      });
    });

    it('leaves a real artist unflagged', () => {
      expect(toArtistRef({ id: 'ar1', name: 'Radiohead' })).toEqual({
        id: 'ar1',
        name: 'Radiohead',
        isVarious: false,
      });
    });
  });
});
