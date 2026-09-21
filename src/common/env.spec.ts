import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFileSecrets, parsePositiveIntEnv, readEnvOrFile } from './env.js';

describe('file-delivered secrets', () => {
  const originalEnv = process.env;
  let dir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    dir = mkdtempSync(join(tmpdir(), 'env-spec-'));
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(dir, { recursive: true, force: true });
  });

  const writeSecret = (name: string, contents: string): string => {
    const path = join(dir, name);
    writeFileSync(path, contents);
    return path;
  };

  describe('readEnvOrFile', () => {
    it('returns the plain variable when no _FILE variable is set', () => {
      process.env.MY_SECRET = 'from-env';
      expect(readEnvOrFile('MY_SECRET')).toBe('from-env');
    });

    it('prefers the file over the plain variable', () => {
      process.env.MY_SECRET = 'from-env';
      process.env.MY_SECRET_FILE = writeSecret('my_secret', 'from-file');
      expect(readEnvOrFile('MY_SECRET')).toBe('from-file');
    });

    it('strips a single trailing newline', () => {
      process.env.MY_SECRET_FILE = writeSecret('my_secret', 'from-file\n');
      expect(readEnvOrFile('MY_SECRET')).toBe('from-file');
    });

    it('falls back to the plain variable when the file is missing', () => {
      process.env.MY_SECRET_FILE = join(dir, 'missing');
      expect(readEnvOrFile('MY_SECRET')).toBeUndefined();

      process.env.MY_SECRET = 'from-env';
      expect(readEnvOrFile('MY_SECRET')).toBe('from-env');
    });
  });

  describe('loadFileSecrets', () => {
    it('maps each _FILE variable to its base name', () => {
      process.env.MY_SECRET_FILE = writeSecret('my_secret', 'from-file');
      process.env.OTHER_VAR = 'not-a-secret';

      const secrets = loadFileSecrets();

      expect(secrets.MY_SECRET).toBe('from-file');
      expect(secrets).not.toHaveProperty('OTHER_VAR');
      expect(secrets).not.toHaveProperty('MY_SECRET_FILE');
    });

    it('does not copy secrets into process.env', () => {
      process.env.MY_SECRET_FILE = writeSecret('my_secret', 'from-file');
      loadFileSecrets();
      expect(process.env.MY_SECRET).toBeUndefined();
    });
  });
});

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
