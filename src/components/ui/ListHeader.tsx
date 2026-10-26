import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './ListHeader.module.css';

export interface HeaderSelect {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

export interface ViewToggle {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

interface ListHeaderProps {
  title: string;
  count?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  selects?: HeaderSelect[];
  toggle?: ViewToggle[];
  right?: ReactNode;
  titleExtra?: ReactNode;
}

/** Search, filters, and view toggle. The page name already sits in the top bar. */
export function ListHeader({ title, search, selects, toggle, right, titleExtra }: ListHeaderProps) {
  return (
    <div className={styles.head}>
      <div className={styles.titleWrap}>
        <h2 className="bg-sr-only">{title}</h2>
        {titleExtra}
      </div>
      <div className={styles.controls}>
        {search && (
          <div className={styles.search}>
            <span className={styles.searchIcon}><Icon name="search" size={16} /></span>
            <input type="search" className={styles.searchInput} value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} />
          </div>
        )}
        {(selects || []).map((s) => (
          <select key={s.label} className={styles.select} value={s.value} onChange={(e) => s.onChange(e.target.value)} aria-label={s.label}>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {toggle && toggle.length > 0 && (
          <div className={styles.toggle}>
            {toggle.map((t) => (
              <button key={t.label} type="button" className={styles.toggleBtn} aria-label={t.label} title={t.label} aria-pressed={t.active} onClick={t.onClick} style={{ background: t.active ? '#2563eb' : '#ffffff', color: t.active ? '#ffffff' : '#64748b' }}>
                <Icon name={t.icon} size={16} />
              </button>
            ))}
          </div>
        )}
        {right}
      </div>
    </div>
  );
}

export interface InnerTab {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function InnerTabs({ tabs }: { tabs: InnerTab[] }) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={t.active} className={styles.tab} onClick={t.onClick} style={{ borderBottomColor: t.active ? '#2563eb' : 'transparent', color: t.active ? '#2563eb' : '#64748b' }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const PageStack = ({ children, gap = 16 }: { children: ReactNode; gap?: number }) => (
  <div className={styles.page} style={{ gap }}>{children}</div>
);
