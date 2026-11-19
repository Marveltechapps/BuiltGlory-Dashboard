/**
 * Production prefers same-origin reverse proxy (`/api`, `/socket.io`).
 * When the API is on a separate HTTPS host, set VITE_API_URL (and optionally
 * VITE_SOCKET_URL) at build time. Empty values keep same-origin behavior.
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** Absolute API origin (no trailing slash) or empty for same-origin. */
export function apiOrigin(): string {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (!raw) return '';
  return trimSlash(raw);
}

/** Absolute Socket.IO origin or empty for same-origin. */
export function socketOrigin(): string {
  const raw = String(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '').trim();
  if (!raw) return '';
  return trimSlash(raw);
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${normalized}` : normalized;
}
