import { readFileSync } from 'node:fs';

const FILE_SUFFIX = '_FILE';

/**
 * Reads a value that may be delivered as a Compose secret. When `<name>_FILE`
 * points to a readable file, returns its contents (trailing newline stripped);
 * otherwise falls back to the plain `<name>` variable. A missing file is not an
 * error because Compose skips creating a secret whose source variable is empty.
 */
export function readEnvOrFile(name: string): string | undefined {
  const path = process.env[`${name}${FILE_SUFFIX}`];

  if (path) {
    try {
      return readFileSync(path, 'utf8').replace(/\r?\n$/, '');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return process.env[name];
}

/**
 * `ConfigModule` loader that resolves every `<name>_FILE` variable to `<name>`,
 * so `ConfigService.get('<name>')` returns file-delivered secrets without
 * copying them into `process.env`.
 */
export function loadFileSecrets(): Record<string, string> {
  const secrets: Record<string, string> = {};

  for (const key of Object.keys(process.env)) {
    if (key.length <= FILE_SUFFIX.length || !key.endsWith(FILE_SUFFIX)) {
      continue;
    }

    const name = key.slice(0, -FILE_SUFFIX.length);
    const value = readEnvOrFile(name);
    if (value !== undefined) {
      secrets[name] = value;
    }
  }

  return secrets;
}

/**
 * Parses an optional integer environment variable. Returns `fallback` when the
 * variable is unset or empty; otherwise returns the parsed value, throwing a
 * clear error that names the variable if it is not a positive integer. This
 * turns a misconfiguration into a startup failure instead of `NaN`/`Infinity`
 * arithmetic later on.
 */
export function parsePositiveIntEnv(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${name} "${raw}": expected a positive integer`);
  }

  return value;
}
