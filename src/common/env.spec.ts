import { parsePositiveIntEnv } from './env.js';

describe('parsePositiveIntEnv', () => {
  it('returns the fallback when the variable is unset or empty', () => {
    expect(parsePositiveIntEnv(undefined, 42, 'MY_VAR')).toBe(42);
    expect(parsePositiveIntEnv('', 42, 'MY_VAR')).toBe(42);
  });

  it('parses a positive integer', () => {
    expect(parsePositiveIntEnv('100', 42, 'MY_VAR')).toBe(100);
  });

  it.each(['abc', '0', '-5', '2.5'])(
    'throws for a non-positive-integer value (%s)',
    (bad) => {
      expect(() => parsePositiveIntEnv(bad, 42, 'MY_VAR')).toThrow(
        `Invalid MY_VAR "${bad}"`,
      );
    },
  );
});
