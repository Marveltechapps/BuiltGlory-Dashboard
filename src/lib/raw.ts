/** Helpers for normalising raw Mongo documents returned by the backend. */

export type Raw = Record<string, unknown>;

export const asRaw = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});

export function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const e = value as Raw;
    return String(e.id ?? e._id ?? '');
  }
  return String(value);
}

export function str(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return fallback;
  return String(value);
}

export function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s ? s : null;
}

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const numOr = (value: unknown, fallback = 0) => num(value) ?? fallback;

export function iso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const bool = (value: unknown) => value === true || value === 'true';

export const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const strArr = (value: unknown): string[] => arr(value).map((v) => str(v)).filter(Boolean);

/** Name of a populated ref (`{ name }`) or the raw string. */
export function nameOf(value: unknown, fallback = ''): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  const e = asRaw(value);
  return str(e.name ?? e.fullName ?? e.email, fallback);
}

export const pick = (raw: Raw, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};
