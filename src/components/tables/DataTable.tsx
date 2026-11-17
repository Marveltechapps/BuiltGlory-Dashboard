import type { ReactNode } from 'react';
import type { BadgeSpec } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import styles from './DataTable.module.css';

export type CellActionVariant = 'outline' | 'ghost' | 'primary' | 'green' | 'red' | 'link';

export interface CellAction {
  label?: string;
  icon?: string;
  title?: string;
  variant?: CellActionVariant;
  disabled?: boolean;
  onClick: () => void;
}

export interface CellFlag {
  text: string;
  bg?: string;
  fg?: string;
  onClick?: () => void;
}

export interface Cell {
  title?: string | number | null;
  sub?: string | null;
  initials?: string;
  /** Image URL; empty string renders the "no photo" placeholder. */
  thumb?: string;
  dot?: string;
  color?: string;
  muted?: boolean;
  strong?: boolean;
  bold?: boolean;
  icon?: string;
  iconColor?: string;
  iconTitle?: string;
  tags?: Array<BadgeSpec | null | false | undefined>;
  badges?: Array<BadgeSpec | null | false | undefined>;
  progress?: number | null;
  progressColor?: string;
  flags?: Array<CellFlag | null | false | undefined>;
  actions?: Array<CellAction | null | false | undefined>;
  wrap?: boolean;
  stop?: boolean;
  node?: ReactNode;
}

export interface Row {
  key: string;
  cells: Array<Cell | null | undefined>;
  onClick?: () => void;
  dim?: boolean;
  highlight?: string;
  checked?: boolean;
  onCheck?: () => void;
}

export interface Pager {
  page: number;
  pages: number;
  size: number;
  sizes: number[];
  label: string;
  setSize: (n: number) => void;
  prev: () => void;
  next: () => void;
}

export type TableState = 'normal' | 'loading' | 'empty' | 'error';

interface DataTableProps {
  columns: Array<string | { label: string }>;
  rows: Row[];
  state?: TableState;
  empty?: { icon?: string; title?: string; text?: string; action?: { label: string; onClick: () => void } };
  onRetry?: () => void;
  errorTitle?: string;
  minWidth?: string;
  selectable?: boolean;
  allChecked?: boolean;
  onToggleAll?: () => void;
  footer?: string;
  pager?: Pager | null;
}

const VARIANT: Record<CellActionVariant, [string, string, string]> = {
  outline: ['#e2e8f0', '#ffffff', '#0f172a'], ghost: ['transparent', 'transparent', '#334155'], primary: ['#2563eb', '#2563eb', '#ffffff'],
  green: ['#bbf7d0', '#f0fdf4', '#15803d'], red: ['#fecaca', '#fef2f2', '#b91c1c'], link: ['transparent', 'transparent', '#2563eb'],
};

const compact = <T,>(list?: Array<T | null | false | undefined>): T[] => (list || []).filter(Boolean) as T[];
const stop = (e: React.MouseEvent) => e.stopPropagation();

function CellView({ c }: { c: Cell }) {
  const actions = compact(c.actions);
  const tags = compact(c.tags);
  const badges = compact(c.badges);
  const flags = compact(c.flags);
  const hasTitle = c.title != null && c.title !== '';
  const progress = c.progress != null ? Math.max(0, Math.min(100, c.progress)) : null;
  const pColor = c.progressColor || ((c.progress || 0) >= 80 ? '#22c55e' : (c.progress || 0) >= 50 ? '#f59e0b' : '#ef4444');
  return (
    <div className={styles.cell}>
      {c.initials && <span className={styles.initials}>{c.initials}</span>}
      {c.thumb ? <img className={styles.thumb} src={c.thumb} alt="" /> : c.thumb === '' ? <span className={styles.thumbEmpty}><Icon name="building-2" size={18} /></span> : null}
      {c.dot && <span className={styles.dot} style={{ background: c.dot }} />}
      <div className={styles.stack}>
        {hasTitle && (
          <div className={styles.titleLine}>
            <span style={{ color: c.color || (c.muted ? '#64748b' : '#0f172a'), fontWeight: c.strong ? 500 : c.bold ? 600 : 400 }}>{c.title}</span>
            {c.icon && <span title={c.iconTitle} style={{ display: 'inline-flex', color: c.iconColor || '#64748b' }}><Icon name={c.icon} size={14} /></span>}
            {tags.map((t, i) => <span key={i} className={styles.tag} style={{ background: t.bg, color: t.fg }}>{t.text}</span>)}
          </div>
        )}
        {c.sub && <span className={styles.sub}>{c.sub}</span>}
        {badges.length > 0 && (
          <div className={styles.badges}>{badges.map((b, i) => <span key={i} className={styles.badge} style={{ background: b.bg, color: b.fg }}>{b.text}</span>)}</div>
        )}
        {progress != null && (
          <div className={styles.progress}>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: progress + '%', background: pColor }} /></div>
            <span className={styles.sub} style={{ fontWeight: 500 }}>{(c.progress || 0) + '%'}</span>
          </div>
        )}
        {flags.length > 0 && (
          <div className={styles.flags}>
            {flags.map((f, i) => (
              <button
                key={i}
                type="button"
                className={styles.flag}
                style={{ background: f.bg || '#ffedd5', color: f.fg || '#c2410c', cursor: f.onClick ? 'pointer' : 'default' }}
                onClick={(e) => { e.stopPropagation(); f.onClick?.(); }}
              >
                {f.text}
              </button>
            ))}
          </div>
        )}
        {c.node}
      </div>
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a, i) => {
            const [border, bg, fg] = VARIANT[a.variant || 'outline'];
            return (
              <button
                key={(a.label || a.icon || '') + i}
                type="button"
                className={styles.action}
                onClick={a.onClick}
                title={a.title || a.label || ''}
                aria-label={a.title || a.label}
                disabled={a.disabled}
                style={{ borderColor: border, background: bg, color: fg, minWidth: a.label ? 'auto' : 32, padding: a.label ? '0 10px' : 0 }}
              >
                {a.icon && <Icon name={a.icon} size={14} />}
                {a.label && <span>{a.label}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DataTable(p: DataTableProps) {
  const state = p.state || 'normal';
  const empty = p.empty || {};
  return (
    <div className={styles.wrap}>
      {state === 'loading' && (
        <div className={styles.skel} aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className={styles.skelRow}>
              <Skeleton style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9999 }} />
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 6 }}>
                <Skeleton style={{ height: 12, width: '38%', borderRadius: 6 }} />
                <Skeleton style={{ height: 10, width: '22%', borderRadius: 6 }} />
              </div>
              <Skeleton style={{ height: 12, width: '14%', borderRadius: 6 }} />
              <Skeleton style={{ height: 20, width: 76, borderRadius: 9999 }} />
              <Skeleton style={{ height: 28, width: 64, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      )}
      {state === 'error' && (
        <div className={styles.state}>
          <span style={{ display: 'inline-flex', color: 'rgba(220,38,38,0.7)' }}><Icon name="alert-circle" size={48} /></span>
          <p className={styles.stateTitle} style={{ marginTop: 12 }}>{p.errorTitle || 'Could not load data'}</p>
          <p className={styles.stateText}>Something went wrong while loading this data.</p>
          {p.onRetry && (
            <button type="button" className={styles.stateBtn} onClick={p.onRetry}><Icon name="refresh-cw" size={16} />Retry</button>
          )}
        </div>
      )}
      {state === 'empty' && (
        <div className={styles.state}>
          <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.4)' }}><Icon name={empty.icon || 'inbox'} size={64} stroke={1.5} /></span>
          <p className={styles.stateTitle} style={{ marginTop: 16 }}>{empty.title || 'Nothing here yet'}</p>
          {empty.text && <p className={styles.stateText}>{empty.text}</p>}
          {empty.action && <button type="button" className={styles.stateBtn} onClick={empty.action.onClick}>{empty.action.label}</button>}
        </div>
      )}
      {state === 'normal' && (
        <>
          <div className={styles.scroll}>
            <table className={styles.table} style={{ minWidth: p.minWidth || '720px' }}>
              <thead>
                <tr className={styles.headRow}>
                  {p.selectable && (
                    <th className={styles.thCheck}><input type="checkbox" className={styles.check} checked={!!p.allChecked} onChange={p.onToggleAll} aria-label="Select all" /></th>
                  )}
                  {p.columns.map((c, i) => <th key={i} className={styles.th}>{typeof c === 'string' ? c : c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr
                    key={r.key}
                    className={styles.row}
                    onClick={r.onClick}
                    style={{ cursor: r.onClick ? 'pointer' : 'default', opacity: r.dim ? 0.6 : 1, background: r.highlight || (r.checked ? 'rgba(239,246,255,0.6)' : 'transparent') }}
                  >
                    {p.selectable && (
                      <td className={styles.tdCheck} onClick={stop}><input type="checkbox" className={styles.check} checked={!!r.checked} onChange={r.onCheck} aria-label="Select row" /></td>
                    )}
                    {r.cells.map((c, i) => {
                      const cell = c || {};
                      const hasActions = compact(cell.actions).length > 0;
                      return (
                        <td key={i} className={styles.td} onClick={hasActions || cell.stop ? stop : undefined} style={{ whiteSpace: cell.wrap ? 'normal' : 'nowrap' }}>
                          <CellView c={cell} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.footer && (
            <div className={styles.footer}>
              <span>{p.footer}</span>
              {p.pager && (
                <div className={styles.pager}>
                  <span>Show:</span>
                  {p.pager.sizes.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={styles.size}
                      onClick={() => p.pager!.setSize(n)}
                      style={{ borderColor: n === p.pager!.size ? '#2563eb' : '#e2e8f0', background: n === p.pager!.size ? '#2563eb' : '#ffffff', color: n === p.pager!.size ? '#ffffff' : '#334155' }}
                    >
                      {n}
                    </button>
                  ))}
                  <span>per page</span>
                  <button type="button" className={styles.nav} onClick={p.pager.prev} disabled={p.pager.page <= 1} style={{ opacity: p.pager.page <= 1 ? 0.4 : 1 }} aria-label="Previous page"><Icon name="chevron-left" size={14} /></button>
                  <span>{p.pager.label}</span>
                  <button type="button" className={styles.nav} onClick={p.pager.next} disabled={p.pager.page >= p.pager.pages} style={{ opacity: p.pager.page >= p.pager.pages ? 0.4 : 1 }} aria-label="Next page"><Icon name="chevron-right" size={14} /></button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
