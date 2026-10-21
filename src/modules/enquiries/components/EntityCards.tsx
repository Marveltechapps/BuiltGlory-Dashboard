import { Icon } from '../../../components/ui/Icon';
import { useViewport } from '../../../hooks/useViewport';
import type { BadgeSpec } from '../../../lib/format';
import styles from './Enquiries.module.css';

export interface EntityCard {
  key: string;
  initials: string;
  title: string;
  sub: string;
  status: BadgeSpec;
  prop: string;
  propSub: string;
  lines: Array<{ label: string; value: string; color?: string }>;
  flags: Array<{ text: string; bg: string; fg: string }>;
  actions: Array<{ icon: string; label: string; color: string; onClick: () => void }>;
  cta: string;
  open: () => void;
}

/** Card grid used by the Buy Enquiries and Sell Requests "card view". */
export function EntityCards({ cards }: { cards: EntityCard[] }) {
  const { vw } = useViewport();
  const cols = vw >= 1280 ? 'repeat(3, minmax(0, 1fr))' : vw >= 768 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
  return (
    <div className={styles.cards} style={{ gridTemplateColumns: cols }}>
      {cards.map((cd) => (
        <div key={cd.key} className={styles.card} onClick={cd.open} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && cd.open()}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span className={styles.avatar}>{cd.initials}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className={styles.ellipsis} style={{ fontWeight: 600 }}>{cd.title}</p>
              <p style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{cd.sub}</p>
            </div>
            <span style={{ whiteSpace: 'nowrap', borderRadius: 9999, padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500, background: cd.status.bg, color: cd.status.fg }}>{cd.status.text}</span>
          </div>
          <div className={styles.propBox}>
            <p className={styles.ellipsis} style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>{cd.prop}</p>
            <p style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{cd.propSub}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {cd.lines.map((ln) => (
              <div key={ln.label}>
                <p className={styles.lineLabel}>{ln.label}</p>
                <p className={styles.ellipsis} style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500, color: ln.color || '#0f172a' }}>{ln.value}</p>
              </div>
            ))}
          </div>
          {cd.flags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cd.flags.map((f) => <span key={f.text} style={{ borderRadius: 9999, padding: '0 8px', fontSize: 11, lineHeight: '18px', fontWeight: 500, background: f.bg, color: f.fg }}>{f.text}</span>)}
            </div>
          )}
          <div className={styles.cardFoot}>
            <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
              {cd.actions.map((a) => (
                <button key={a.label} type="button" className={styles.cardBtn} title={a.label} style={{ color: a.color }} onClick={a.onClick}>
                  <Icon name={a.icon} size={14} />{a.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: '#2563eb' }}>{cd.cta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
