import type { DetailAction, FormInput, SectionSpec } from '../../types/detail';
import { Icon } from './Icon';
import { SkeletonRows } from './Skeleton';
import { BANNER_TONES, variantStyle } from './variants';
import styles from './DetailSection.module.css';

const compact = <T,>(list?: Array<T | null | false | undefined>): T[] => (list || []).filter(Boolean) as T[];

function ActionButton({ a, block, className }: { a: DetailAction; block?: boolean; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={a.onClick}
      disabled={a.disabled || a.loading}
      title={a.title || ''}
      style={{ ...variantStyle(a.variant), justifyContent: block ? 'flex-start' : 'center' }}
    >
      {a.loading && <Icon name="loader-2" size={14} spin />}
      {a.label}
    </button>
  );
}

function Input({ i }: { i: FormInput }) {
  const t = i.type || 'text';
  const opts = (i.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const invalid = i.error ? 'true' : undefined;
  if (t === 'select') {
    return (
      <select className="bg-input" aria-invalid={invalid} value={String(i.value ?? '')} onChange={(e) => i.onChange?.(e.target.value)}>
        <option value="">{i.placeholder || 'Select…'}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (t === 'textarea') {
    return <textarea className="bg-input" aria-invalid={invalid} rows={3} value={String(i.value ?? '')} placeholder={i.placeholder} onChange={(e) => i.onChange?.(e.target.value)} />;
  }
  if (t === 'checkbox') {
    return (
      <span className={styles.checkInput}>
        <input type="checkbox" checked={!!i.value} onChange={(e) => i.onChange?.(e.target.checked)} />
        {i.label}
      </span>
    );
  }
  if (t === 'file') {
    return <input className="bg-input" style={{ paddingTop: 6 }} type="file" accept={i.accept} aria-invalid={invalid} onChange={(e) => i.onFile?.(e.target.files?.[0] ?? null)} />;
  }
  return (
    <input
      className="bg-input"
      aria-invalid={invalid}
      type={t}
      value={String(i.value ?? '')}
      placeholder={i.placeholder}
      min={i.min}
      max={i.max}
      onChange={(e) => i.onChange?.(e.target.value)}
    />
  );
}

export function DetailSection({ s }: { s: SectionSpec }) {
  const fields = compact(s.fields);
  const checks = compact(s.checks);
  const rows = compact(s.rows);
  const form = compact(s.form);
  const actions = compact(s.actions);
  const banners = compact(s.banners);
  const fieldCols = s.cols === 1 ? 'minmax(0, 1fr)' : s.cols === 3 ? 'repeat(auto-fit, minmax(140px, 1fr))' : 'repeat(auto-fit, minmax(170px, 1fr))';
  const cls = [styles.section, s.tone === 'next' ? styles.next : s.tone === 'danger' ? styles.danger : '', s.flat ? styles.flat : ''].join(' ');

  return (
    <div className={cls}>
      {(s.title || s.subtitle) && (
        <div className={styles.head}>
          <div style={{ minWidth: 0 }}>
            <h3 className={styles.title}>{s.title}</h3>
            {s.subtitle && <p className={styles.subtitle}>{s.subtitle}</p>}
          </div>
          {s.tag && <span className={styles.tag}>📱 {s.tag}</span>}
        </div>
      )}
      <div className={styles.content}>
        {banners.map((b, i) => {
          const [bg, fg, border] = BANNER_TONES[b.tone || 'info'];
          return (
            <div key={i} className={styles.banner} style={{ background: bg, color: fg, borderColor: border }}>
              <span>{b.text}</span>
              {b.action && <button type="button" className={styles.bannerAction} style={{ color: fg }} onClick={b.action.onClick}>{b.action.label}</button>}
            </div>
          );
        })}
        {s.images && s.images.length > 0 && (
          <div className={styles.images}>{s.images.map((im) => <img key={im} src={im} alt="" />)}</div>
        )}
        {fields.length > 0 && (
          <div className={styles.fields} style={{ gridTemplateColumns: fieldCols }}>
            {fields.map((f, i) => {
              const empty = f.value == null || f.value === '';
              return (
                <div key={f.label + i} style={{ minWidth: 0 }}>
                  <p className={styles.fieldLabel}>{f.label}</p>
                  <p className={styles.fieldValue} style={{ fontWeight: f.strong ? 600 : 500, color: f.color || (empty ? '#94a3b8' : '#0f172a') }}>{empty ? 'Not provided' : String(f.value)}</p>
                </div>
              );
            })}
          </div>
        )}
        {s.text && <p className={styles.text}>{s.text}</p>}
        {s.custom}
        {checks.length > 0 && (
          <div className={styles.checks}>
            {checks.map((c) => (
              <label key={c.label} className={styles.check} style={{ cursor: c.onToggle ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={!!c.done} onChange={c.onToggle} disabled={!c.onToggle} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: c.done ? '#15803d' : '#0f172a' }}>{c.label}</span>
                  {c.sub && <span className={styles.checkSub}>{c.sub}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <div className={styles.rows}>
            {rows.map((r, i) => {
              const ra = compact(r.actions);
              return (
                <div key={r.key ?? i} className={styles.row} onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : 'default' }}>
                  {r.initials && <span className={styles.rowInitials}>{r.initials}</span>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className={styles.rowTitle}>{r.title}</p>
                    {r.sub && <p className={styles.rowSub}>{r.sub}</p>}
                  </div>
                  {compact(r.badges).map((b, j) => <span key={j} className={styles.rowBadge} style={{ background: b.bg, color: b.fg }}>{b.text}</span>)}
                  {r.right && <span className={styles.rowRight} style={{ color: r.rightColor || '#0f172a' }}>{r.right}</span>}
                  {ra.length > 0 && (
                    <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                      {ra.map((a, j) => <ActionButton key={j} a={a} className={styles.rowBtn} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {s.chips && s.chips.length > 0 && (
          <div className={styles.chips}>
            {s.chips.map((c) => (
              <button
                key={c.label}
                type="button"
                className={styles.chip}
                onClick={c.onClick}
                style={{ borderColor: c.on ? '#2563eb' : '#e2e8f0', background: c.on ? '#eff6ff' : '#ffffff', color: c.on ? '#1d4ed8' : '#334155' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {form.length > 0 && (
          <div className={styles.form} style={{ gridTemplateColumns: s.formCols === 1 ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {form.map((i) => {
              const t = i.type || 'text';
              return (
                <label key={i.key} className={styles.formLabel} style={{ gridColumn: i.full || t === 'textarea' ? '1 / -1' : 'auto' }}>
                  {t !== 'checkbox' && i.label && (
                    <span>
                      {i.label}
                      {i.required && <span className={styles.req}> *</span>}
                    </span>
                  )}
                  <Input i={i} />
                  {i.error && <span className={styles.err}>{i.error}</span>}
                  {i.hint && <span className={styles.hint}>{i.hint}</span>}
                </label>
              );
            })}
          </div>
        )}
        {s.timeline && s.timeline.length > 0 && (
          <div className={styles.timeline}>
            {s.timeline.map((t, i) => (
              <div key={i} className={styles.tItem}>
                <span className={styles.tDot} style={{ background: t.color || '#2563eb' }} />
                <div style={{ minWidth: 0 }}>
                  <p className={styles.tText}>{t.text}</p>
                  <p className={styles.tTime}>{t.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {s.empty && (/^loading/i.test(s.empty) ? <SkeletonRows /> : <p className={styles.empty}>{s.empty}</p>)}
        {actions.length > 0 && (
          <div className={styles.actions} style={{ flexDirection: s.stack ? 'column' : 'row' }}>
            {actions.map((a, i) => <ActionButton key={a.label + i} a={a} block={s.stack} className={styles.actionBtn} />)}
          </div>
        )}
      </div>
    </div>
  );
}
