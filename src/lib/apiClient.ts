import { useAuthStore } from '../store/authStore';
import { apiUrl } from './runtimeConfig';

/**
 * Fetch wrapper. `path` is relative to `/api`, so services pass `/v1/admin/...`
 * and the browser requests `/api/v1/admin/...`.
 *
 * Default: same-origin (Vite proxies in dev; reverse proxy in production).
 * Optional: set `VITE_API_URL=https://api…` for a split HTTPS API host.
 *
 * The backend wraps every success in `{ data, meta }` and every error in
 * `{ error: { code, message, details }, meta }`. `apiRequest` unwraps `data`;
 * `apiRequestEnvelope` also returns `meta` (pagination totals).
 */

export interface ApiMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  meta?: { requestId?: string };
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(message: string, status: number, body?: ApiErrorBody | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
    this.requestId = body?.meta?.requestId;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | null | undefined | Array<string | number>>;
  signal?: AbortSignal;
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean;
}

export function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let refreshing: Promise<boolean> | null = null;
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = 'bg-admin-last-activity';

/** Records dashboard activity so a silent token refresh cannot extend an idle session. */
export function touchAdminActivity() {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export function adminIdleExpired() {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) > IDLE_LIMIT_MS;
  } catch {
    return false;
  }
}

async function refreshSession(): Promise<boolean> {
  const session = useAuthStore.getState().session;
  if (!session?.refreshToken) return false;
  if (!refreshing) {
    refreshing = fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const body = (await parseBody(res)) as ApiEnvelope<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> | null;
        if (!body?.data?.accessToken) return false;
        useAuthStore.getState().updateTokens(body.data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function send(path: string, options: RequestOptions, retried: boolean): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.anonymous ? null : useAuthStore.getState().session?.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.formData) body = options.formData;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const url = apiUrl(`/api/${path.replace(/^\//, '')}${buildQuery(options.query)}`);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
    credentials: 'include',
  });
  if (response.status === 401 && token && !retried) {
    if (adminIdleExpired()) {
      useAuthStore.getState().expire();
      return response;
    }
    const ok = await refreshSession();
    if (ok) return send(path, options, true);
    useAuthStore.getState().expire();
  }
  return response;
}

export async function apiRequestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const response = await send(path, options, false);
  const payload = await parseBody(response);
  if (!response.ok) {
    const err = payload as ApiErrorBody | null;
    throw new ApiError(err?.error?.message || `API request failed: ${response.status}`, response.status, err);
  }
  if (payload && typeof payload === 'object' && 'data' in (payload as object)) return payload as ApiEnvelope<T>;
  return { data: payload as T };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await apiRequestEnvelope<T>(path, options);
  return envelope.data;
}

/** Fetches a binary response (file downloads). */
export async function apiDownload(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options, false);
  if (!response.ok) {
    const err = (await parseBody(response)) as ApiErrorBody | null;
    throw new ApiError(err?.error?.message || `API request failed: ${response.status}`, response.status, err);
  }
  return response.blob();
}

/** Human-readable message, including Joi field errors from `error.details`. */
export function formatApiError(error: unknown, fallback = 'Request failed.'): string {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details) && error.details.length > 0) {
      const msgs = error.details
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const item = d as { field?: string; message?: string };
          if (!item.message) return null;
          const field = item.field?.replace(/^(body|query|params)\./, '');
          return field ? `${field}: ${item.message}` : item.message;
        })
        .filter((m): m is string => Boolean(m));
      if (msgs.length) return msgs.join('. ');
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
