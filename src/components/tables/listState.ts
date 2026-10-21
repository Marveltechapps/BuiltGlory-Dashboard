import type { UseQueryResult } from '@tanstack/react-query';
import type { TableState } from './DataTable';

export interface EmptySpec {
  icon?: string;
  title?: string;
  text?: string;
  action?: { label: string; onClick: () => void };
}

/** loading → error → empty → normal, from a list query and the filtered rows. */
export function tableStateOf(q: Pick<UseQueryResult, 'isPending' | 'isError'>, rows: unknown[]): TableState {
  if (q.isPending) return 'loading';
  if (q.isError) return 'error';
  return rows.length === 0 ? 'empty' : 'normal';
}

/**
 * Reference empty-state rules: nothing loaded → base copy; search with no hits → "No results found";
 * otherwise a filter hid everything → "Nothing matches this filter".
 */
export function emptyFor(
  allCount: number,
  filteredCount: number,
  search: string,
  base: EmptySpec & { noResults?: string },
  clearSearch: () => void,
  clearFilters: () => void,
): EmptySpec {
  if (allCount === 0) return base;
  if (search.trim() && filteredCount === 0) return { icon: 'search-x', title: 'No results found', text: base.noResults || 'Try a different search term', action: { label: 'Clear search', onClick: clearSearch } };
  return { icon: 'filter-x', title: 'Nothing matches this filter', text: 'Try a different status or filter', action: { label: 'Clear filter', onClick: clearFilters } };
}

export const matches = (q: string, ...fields: Array<string | number | null | undefined>) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some((v) => String(v ?? '').toLowerCase().includes(s));
};

/** Persisted per-tab view mode (table / cards / calendar). */
export function readView(tab: string, def: string) {
  try {
    return localStorage.getItem('bg-view-' + tab) || def;
  } catch {
    return def;
  }
}

export function writeView(tab: string, v: string) {
  try {
    localStorage.setItem('bg-view-' + tab, v);
  } catch {
    /* storage unavailable */
  }
}
