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
