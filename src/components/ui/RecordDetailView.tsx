import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TONE } from '../../constants/labels';
import { useViewport } from '../../hooks/useViewport';
import type { Crumb, DetailAction, DetailTab, HeaderBadge, PageBanner, SectionSpec, StepSpec } from '../../types/detail';
import { DetailSection } from './DetailSection';
import { BANNER_TONES, variantStyle } from './variants';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import styles from './RecordDetailView.module.css';

export interface RecordDetailViewProps {
  state: 'loading' | 'error' | 'notFound' | 'ok';
  isPage?: boolean;
  errorTitle?: string;
  onRetry?: () => void;
  nfTitle?: string;
  backLabel?: string;
  backPath?: string;
  crumbs?: Crumb[];
  banners?: Array<PageBanner | null | false | undefined>;
  title?: string;
  meta?: string;
  badges?: Array<HeaderBadge | null | false | undefined>;
  hActions?: Array<DetailAction | null | false | undefined>;
  tabs?: DetailTab[];
  steps?: StepSpec[];
  currentStep?: number;
  stepsDim?: boolean;
  stepNote?: { text: string; tone: string } | null;
  main?: Array<SectionSpec | null | false | undefined>;
  side?: Array<SectionSpec | null | false | undefined>;
  single?: boolean;
  sideW?: string;
  maxW?: string;
  children?: ReactNode;
}

const compact = <T,>(list?: Array<T | null | false | undefined>): T[] => (list || []).filter(Boolean) as T[];

/** Generic record/config page layout: breadcrumbs, header card, step tracker, tabs, main + side section columns. */
export function RecordDetailView(p: RecordDetailViewProps) {
  const navigate = useNavigate();
  const { isLg } = useViewport();
  const maxW = p.maxW || (p.isPage ? '1600px' : '1100px');
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(p.backPath || '/admin/overview'));
  const side = compact(p.side);
  const cols = p.single || !side.length ? 'minmax(0, 1fr)' : isLg ? 'minmax(0, 1fr) ' + (p.sideW || '340px') : 'minmax(0, 1fr)';

  if (p.state === 'loading') {
    return (
      <div className={styles.wrap} style={{ maxWidth: maxW }} aria-busy="true">
        <Skeleton style={{ height: 20, width: '40%', borderRadius: 6 }} />
        <Skeleton style={{ height: 120, borderRadius: 12 }} />
        <div className={styles.grid} style={{ gridTemplateColumns: isLg ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)' }}>
          <Skeleton style={{ height: 420, borderRadius: 12 }} />
          <Skeleton style={{ height: 420, borderRadius: 12 }} />
        </div>
      </div>
    );
  }
  if (p.state === 'error') {
    return (
      <div className={styles.wrap} style={{ maxWidth: maxW }}>
        <div className={styles.stateBox}>
          <span style={{ display: 'inline-flex', color: 'rgba(220,38,38,0.7)' }}><Icon name="alert-circle" size={48} /></span>
          <p className={styles.stateTitle}>{p.errorTitle || (p.isPage ? 'Could not load this page' : 'Could not load this record')}</p>
          {p.onRetry && <button type="button" className={styles.stateBtn} onClick={p.onRetry}>Retry</button>}
        </div>
      </div>
    );
  }
  if (p.state === 'notFound') {
    return (
      <div className={styles.wrap} style={{ maxWidth: maxW }}>
        <div className={styles.stateBox}>
          <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.4)' }}><Icon name="search-x" size={64} stroke={1.5} /></span>
          <p className={styles.stateTitle} style={{ marginTop: 16 }}>{p.nfTitle || 'Record not found'}</p>
          <p className={styles.stateText}>It may have been deleted or the link is incorrect.</p>
          <button type="button" className={styles.stateBtn} onClick={back}>{p.backLabel || 'Go back'}</button>
        </div>
      </div>
    );
  }

  const crumbs = p.crumbs || [];
  const steps = p.steps || [];
  const current = p.currentStep ?? -1;
  const hActions = compact(p.hActions);

  return (
    <div className={styles.wrap} style={{ maxWidth: maxW }}>
      {crumbs.length > 0 && (
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <button type="button" className={styles.crumbBack} aria-label="Back" onClick={back}><Icon name="chevron-left" size={16} /></button>
          {crumbs.map((c, i) => (
            <span key={c.label + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {i < crumbs.length - 1 ? (
                <>
                  <button type="button" className={styles.crumbLink} onClick={c.path ? () => navigate(c.path!) : back}>{c.label}</button>
                  <span className={styles.crumbSep}>›</span>
                </>
              ) : (
                <span className={styles.crumbLast}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {compact(p.banners).map((b, i) => {
        const [bg, fg, border] = BANNER_TONES[b.tone || 'info'];
        return (
          <div key={i} className={styles.banner} style={{ background: bg, color: fg, borderColor: border }}>
            <span style={{ fontWeight: 500 }}>{b.text}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {(b.actions || []).map((a) => (
                <button key={a.label} type="button" className={styles.bannerBtn} style={{ borderColor: border, color: fg }} onClick={a.onClick}>{a.label}</button>
              ))}
              {b.dismiss && (
                <button type="button" aria-label="Dismiss" style={{ display: 'inline-flex', color: fg }} onClick={b.dismiss}><Icon name="x" size={16} /></button>
              )}
            </div>
          </div>
        );
      })}

      {(p.title || p.meta || hActions.length > 0) && (
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{p.title}</h1>
            {compact(p.badges).map((b, i) => {
              const t = TONE[b.tone || 'muted'] || TONE.muted!;
              return (
                <span
                  key={b.text + i}
                  className={styles.hBadge}
                  style={{ background: b.dot ? '#ffffff' : t[0], color: b.dot ? '#0f172a' : t[1], borderColor: b.dot ? '#e2e8f0' : t[0] }}
                >
                  {b.dot && <span style={{ width: 8, height: 8, borderRadius: 9999, background: b.dot }} />}
                  {b.text}
                </span>
              );
            })}
          </div>
          {p.meta && <p className={styles.meta}>{p.meta}</p>}
          {hActions.length > 0 && (
            <div className={styles.hActions}>
              {hActions.map((a, i) => (
                <button key={a.label + i} type="button" className={styles.hBtn} style={variantStyle(a.variant)} onClick={a.onClick} disabled={a.disabled || a.loading} title={a.title || ''}>
                  {a.loading && <Icon name="loader-2" size={14} spin />}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {p.tabs && p.tabs.length > 0 && (
        <div className={styles.tabs} role="tablist">
          {p.tabs.map((t) => (
            <button key={t.label} type="button" role="tab" aria-selected={t.active} className={styles.tab} onClick={t.onClick} style={{ borderBottomColor: t.active ? '#2563eb' : 'transparent', color: t.active ? '#2563eb' : '#64748b' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <div className={styles.steps}>
          {p.stepNote && (
            <p className={styles.stepNote} style={{ background: (TONE[p.stepNote.tone] || TONE.muted!)[0], color: (TONE[p.stepNote.tone] || TONE.muted!)[1] }}>{p.stepNote.text}</p>
          )}
          <div className={styles.stepRow}>
            {steps.map((st, i) => {
              const done = current >= 0 && i < current;
              const cur = i === current && !p.stepsDim;
              const on = done || cur;
              return (
                <div key={st.value} className={styles.step}>
                  {i > 0 && <span className={styles.stepLine} style={{ background: i <= current && current >= 0 ? '#2563eb' : '#e2e8f0' }} />}
                  <span
                    className={styles.stepDot}
                    style={{ background: on ? '#2563eb' : '#f1f5f9', color: on ? '#ffffff' : '#64748b', borderColor: on ? '#2563eb' : '#e2e8f0', boxShadow: cur ? '0 0 0 3px rgba(37,99,235,0.3)' : 'none' }}
                  >
                    {on ? <Icon name="check" size={14} /> : String(i + 1)}
                  </span>
                  <span className={styles.stepLabel} style={{ color: cur ? '#2563eb' : done ? '#0f172a' : '#64748b', fontWeight: cur ? 600 : 400 }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.grid} style={{ gridTemplateColumns: cols }}>
        <div className={styles.col}>
          {compact(p.main).map((s, i) => <DetailSection key={s.key ?? s.title ?? i} s={s} />)}
        </div>
        {side.length > 0 && (
          <div className={styles.col}>
            {side.map((s, i) => <DetailSection key={s.key ?? s.title ?? i} s={s} />)}
          </div>
        )}
      </div>
      {p.children}
    </div>
  );
}
