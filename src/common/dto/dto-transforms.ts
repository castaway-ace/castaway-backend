import { Transform } from 'class-transformer';

export const ToBoolean = () => {
  return Transform(({ value }): boolean | undefined => {
    if (value === 'true' || value === '') return true;
    if (value === 'false') return false;
    return undefined;
  });
};

export const ToStringArray = () => {
  return Transform(({ value }): string[] | undefined => {
    if (value === undefined || typeof value !== 'string') return undefined;
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  });
};

export function ToInt() {
  return Transform(({ value }): number | undefined => {
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  });
}

export function Trim() {
  return Transform(({ value }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );
}
