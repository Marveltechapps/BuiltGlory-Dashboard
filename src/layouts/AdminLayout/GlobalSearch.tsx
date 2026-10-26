import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useClickOutside, useDebounced } from '../../hooks/useDomUtils';
import { searchDashboard } from '../../services/search';
import type { SearchResult } from '../../types/overview';
import styles from './AdminLayout.module.css';

const ORDER: Array<[SearchResult['type'], string]> = [['property', 'Properties'], ['user', 'Users'], ['enquiry', 'Enquiries'], ['acquisition', 'Acquisitions'], ['deal', 'Sales Deals']];

/** First row the dropdown actually shows (results are grouped, so results[0] can be a later group). */
function firstShown(results: SearchResult[]) {
  for (const [type] of ORDER) {
    const hit = results.find((item) => item.type === type);
    if (hit) return hit;
  }
  return undefined;
}

function useSearch(q: string) {
  const dq = useDebounced(q.trim(), 250);
  const enabled = dq.length >= 2;
  const query = useQuery({ queryKey: ['search', dq], queryFn: ({ signal }) => searchDashboard(dq, signal), enabled, staleTime: 30_000, retry: false });
  const pending = q.trim().length >= 2 && (dq !== q.trim() || query.isFetching);
  return { results: enabled ? query.data ?? [] : [], loading: pending, error: query.isError };
}

function Results({ q, results, loading, onSelect, compact }: { q: string; results: SearchResult[]; loading: boolean; onSelect: (r: SearchResult) => void; compact?: boolean }) {
  const groups = ORDER.map(([type, label]) => ({ label, items: results.filter((r) => r.type === type) })).filter((g) => g.items.length > 0);
  if (loading) return <div style={{ padding: '8px 16px 12px' }}><SkeletonRows count={3} /></div>;
  if (!results.length) {
    return (
      <div className={styles.noResults}>
        <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.5)' }}><Icon name="search-x" size={40} /></span>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: '20px', color: '#64748b' }}>{"No results for '" + q + "'"}</p>
      </div>
    );
  }
  return (
    <>
      <div style={{ maxHeight: compact ? 'min(300px, 50vh)' : 'min(420px, 70vh)', overflowY: 'auto' }}>
        {groups.map((g) => (
          <div key={g.label}>
            <p className={styles.groupLabel}>{g.label}</p>
            {g.items.map((r) => (
              <button key={r.type + r.id} type="button" role="option" aria-selected={false} className={styles.result} onClick={() => onSelect(r)}>
                <span className={styles.emoji}>{r.emoji}</span>
                <span className={styles.rText}>
                  <span className={styles.rTitle}>{r.title}</span>
                  <span className={styles.rSub}>{r.subtitle}</span>
                </span>
                <span style={{ display: 'inline-flex', color: '#64748b' }}><Icon name="chevron-right" size={16} /></span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.resultsFoot}>Press Enter for first result • Esc to close</p>
    </>
  );
}

/** Header search (md+): GET /admin/search with grouped results. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const { results, loading } = useSearch(q);
  const select = (r: SearchResult) => {
    setOpen(false);
    setQ('');
    navigate(r.route);
  };
  return (
    <div className={styles.searchWrap}>
      <div ref={ref} className={styles.searchBox}>
        <span className={styles.searchIcon}><Icon name="search" size={16} /></span>
        <input
          type="search"
          className={styles.searchInput}
          value={q}
          placeholder="Search properties, users, enquiries..."
          aria-label="Search properties, users, enquiries"
          onChange={(e) => { setQ(e.target.value); setOpen(e.target.value.length >= 2); }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQ(''); }
            if (e.key === 'Enter') { const hit = firstShown(results); if (hit) select(hit); }
          }}
        />
        {open && q.length >= 2 && (
          <div role="listbox" className={styles.results}>
            <Results q={q} results={results} loading={loading} onSelect={select} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Small-screen search button with popover. */
export function MobileSearch({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const { results, loading } = useSearch(q);
  const select = (r: SearchResult) => {
    setOpen(false);
    setQ('');
    navigate(r.route);
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className={styles.iconBtn} onClick={() => setOpen(!open)} aria-label="Search" aria-expanded={open}>
        <Icon name="search" size={20} />
      </button>
      {open && (
        <div className={styles.drop} style={{ width: 'min(360px, calc(100vw - 1.5rem))', padding: 12 }}>
          <div style={{ position: 'relative' }}>
            <span className={styles.searchIcon}><Icon name="search" size={16} /></span>
            <input
              type="search"
              autoFocus
              className={styles.searchInput}
              style={{ padding: '0 12px 0 40px' }}
              value={q}
              placeholder="Search..."
              aria-label="Search"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQ(''); }
                if (e.key === 'Enter') { const hit = firstShown(results); if (hit) select(hit); }
              }}
            />
          </div>
          {q.length >= 2 && (
            <div role="listbox" style={{ marginTop: 8, maxHeight: 'min(360px, 60vh)', overflow: 'hidden', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <Results q={q} results={results} loading={loading} onSelect={select} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
