import { useState } from 'react';
import { useElementWidth } from '../../../hooks/useDomUtils';
import { arcPath, CHART_COLORS, labelOf } from '../../../components/charts/chartMath';
import styles from './Overview.module.css';

/** Donut chart for "Properties by Type" with legend + hover tooltip. */
export function PropertiesDonut({ data }: { data: Array<{ value?: string; count: number }> }) {
  const { ref, el, width: PW } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; mx: number; my: number } | null>(null);
  const pie = data.filter((t) => t.count > 0).map((t, i) => ({ name: labelOf(t.value), value: t.count, color: CHART_COLORS[i % CHART_COLORS.length]! }));
  if (!pie.length) return <div className={styles.chartBox}>No active property mix yet</div>;

  const total = pie.reduce((t, d) => t + d.value, 0);
  const summary = 'Active property mix totals ' + total + ' properties: ' + pie.map((d) => d.name + ' ' + d.value).join(', ') + '.';
  const maxLen = Math.max(...pie.map((d) => d.name.length));
  const legendW = Math.ceil(16 + 12 + maxLen * 6.2 + 10);
  const cx = 5 + (PW - 10 - legendW) * 0.35;
  const cy = 140;
  const pad = pie.length === 1 ? 0 : 2;
  const real = 360 - pad * pie.length;
  let start = 0;
  const sectors = pie.map((d) => {
    const ang = pie.length === 1 ? 359.999 : (d.value / total) * real;
    const a0 = start;
    const a1 = start + ang;
    start = a1 + pad;
    return { d: arcPath(cx, cy, 55, 90, a0, a1), color: d.color };
  });
  const h = hover && pie[hover.i] ? hover : null;
  const tipW = 110;

  return (
    <div ref={ref} role="img" aria-label={summary} style={{ position: 'relative', height: 280, width: '100%' }}>
      {PW > 60 && (
        <svg width={PW} height={280} style={{ display: 'block', overflow: 'visible' }}>
          {sectors.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill={s.color}
              stroke="#ffffff"
              onMouseMove={(e) => {
                const r = el ? el.getBoundingClientRect() : { left: 0, top: 0 };
                setHover({ i, mx: e.clientX - r.left, my: e.clientY - r.top });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      <div style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
        {pie.map((lg) => (
          <div key={lg.name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 10 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, flexShrink: 0, borderRadius: 9999, background: lg.color }} />
            <span style={{ color: lg.color }}>{lg.name}</span>
          </div>
        ))}
      </div>
      {h && (
        <div className={styles.chartTip} style={{ left: h.mx + 10 + tipW > PW ? h.mx - 10 - tipW : h.mx + 10, top: Math.max(0, h.my - 40), color: pie[h.i]!.color }}>
          {pie[h.i]!.value} properties
        </div>
      )}
    </div>
  );
}
