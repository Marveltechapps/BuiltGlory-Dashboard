import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../lib/apiClient';

/** Maps a record query to the RecordDetailView state (404 / invalid id → not found). */
export function detailStateOf(q: Pick<UseQueryResult, 'isPending' | 'isError' | 'error'>): 'loading' | 'error' | 'notFound' | 'ok' {
  if (q.isPending) return 'loading';
  if (q.isError) {
    const e = q.error;
    if (e instanceof ApiError && (e.status === 404 || e.status === 400 || e.status === 422)) return 'notFound';
    return 'error';
  }
  return 'ok';
}

export const isObjectId = (id: string | undefined | null) => !!id && /^[a-f0-9]{24}$/i.test(id);
