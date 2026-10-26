import { apiRequestEnvelope, type ApiMeta, type RequestOptions } from './apiClient';
import { asRaw, arr, type Raw } from './raw';

export interface ListResult<T> {
  items: T[];
  total: number;
  /** True when more records exist than were loaded (cap reached). */
  truncated: boolean;
}

/**
 * Loads every page of an admin list endpoint (limit 100 per page, capped at `maxPages`)
 * so status tabs, counts and client-side filters match the full dataset.
 */
export async function fetchAllPages<T>(
  path: string,
  map: (raw: Raw) => T,
  query: RequestOptions['query'] = {},
  signal?: AbortSignal,
  maxPages = 50,
): Promise<ListResult<T>> {
  const items: T[] = [];
  let page = 1;
  let meta: ApiMeta | undefined;
  do {
    const res = await apiRequestEnvelope<Raw[]>(path, { query: { limit: 100, ...query, page }, signal });
    meta = res.meta;
    arr(res.data).forEach((r) => items.push(map(asRaw(r))));
    const totalPages = Number(meta?.totalPages) || 1;
    if (page >= totalPages || arr(res.data).length === 0) break;
    page += 1;
  } while (page <= maxPages);
  const total = Number(meta?.total) || items.length;
  return { items, total, truncated: total > items.length };
}

/** Single page with pagination meta (server-side paging). */
export async function fetchPage<T>(path: string, map: (raw: Raw) => T, query: RequestOptions['query'] = {}, signal?: AbortSignal) {
  const res = await apiRequestEnvelope<Raw[]>(path, { query, signal });
  const items = arr(res.data).map((r) => map(asRaw(r)));
  return { items, total: Number(res.meta?.total) || items.length, page: Number(res.meta?.page) || 1, totalPages: Number(res.meta?.totalPages) || 1 };
}
