import { useState } from 'react';
import { useElementWidth } from '../../../hooks/useDomUtils';
import { monotonePath, niceStep } from '../../../components/charts/chartMath';
import styles from './Overview.module.css';

interface Point {
  day: string;
  count: number;
}

/** Monotone line chart for "Enquiries Over Last 7 Days". */
export function EnquiriesChart({ data }: { data: Point[] }) {
  const { ref, width: W } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ mx: number; my: number } | null>(null);
  if (!data.length) return <div className={styles.chartBox}>No enquiry trend data yet</div>;

  const allZero = data.every((d) => d.count === 0);
  const total = data.reduce((t, d) => t + d.count, 0);
  const peak = Math.max(0, ...data.map((d) => d.count));
  const summary = allZero
    ? 'No enquiries were recorded in the last 7 days.'
    : total + ' enquiries were recorded in the last 7 days. Peak day: ' + data.filter((d) => d.count === peak).map((d) => d.day + ' with ' + d.count).join(', ') + '.';

  const x0 = 48;
  const x1 = W - 8;
  const y0 = 8;
  const y1 = 250;
  const n = data.length;
  const step = niceStep(peak);
  const top = step * 4;
  const yOf = (v: number) => y1 - (v / top) * (y1 - y0);
  const xOf = (i: number) => (n === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
  const pts = data.map((d, i) => [xOf(i), yOf(d.count)] as [number, number]);
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  let cursor: { x: number; y: number } | null = null;
  let tip: { label: string; value: number; left: number; top: number } | null = null;
  if (hover && W > 60) {
    const idx = Math.max(0, Math.min(n - 1, Math.round(((hover.mx - x0) / (x1 - x0)) * (n - 1))));
    const cx = xOf(idx);
    cursor = { x: cx, y: yOf(data[idx]!.count) };
    const tipW = 110;
    tip = { label: data[idx]!.day, value: data[idx]!.count, left: cx + 10 + tipW > W ? cx - 10 - tipW : cx + 10, top: Math.max(0, Math.min(210, hover.my - 30)) };
  }

  return (
    <>
      {allZero && <p style={{ marginBottom: 8, textAlign: 'center', fontSize: 12, lineHeight: '16px', color: '#64748b' }}>No enquiries this week</p>}
      <div ref={ref} role="img" aria-label={summary} style={{ position: 'relative', height: 280, width: '100%' }}>
        {W > 60 && (
          <svg width={W} height={280} style={{ display: 'block', overflow: 'visible' }}>
            {ticks.map((t) => <line key={'g' + t} x1={x0} x2={x1} y1={yOf(t)} y2={yOf(t)} stroke="#e2e8f0" strokeDasharray="3 3" />)}
            <line x1={x0} x2={x0} y1={8} y2={250} stroke="#94a3b8" />
            <line x1={x0} x2={x1} y1={250} y2={250} stroke="#94a3b8" />
            {ticks.map((t) => (
              <g key={'y' + t}>
                <line x1={x0 - 6} x2={x0} y1={yOf(t)} y2={yOf(t)} stroke="#94a3b8" />
                <text x={x0 - 8} y={yOf(t)} dy="0.355em" textAnchor="end" fontSize={12} fill="#94a3b8">{String(t)}</text>
              </g>
            ))}
            {data.map((d, i) => (
              <g key={'x' + i}>
                <line x1={xOf(i)} x2={xOf(i)} y1={250} y2={256} stroke="#94a3b8" />
                <text x={xOf(i)} y={258} dy="0.71em" textAnchor="middle" fontSize={12} fill="#94a3b8">{d.day}</text>
              </g>
            ))}
            {cursor && <line x1={cursor.x} x2={cursor.x} y1={8} y2={250} stroke="#cccccc" />}
            <path d={monotonePath(pts)} fill="none" stroke="#2563eb" strokeWidth={2.5} />
            {pts.map(([x, y], i) => <circle key={'d' + i} cx={x} cy={y} r={4} fill="#2563eb" stroke="#2563eb" strokeWidth={2.5} />)}
            {cursor && <circle cx={cursor.x} cy={cursor.y} r={6} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />}
            <rect
              x={x0}
              y={8}
              width={Math.max(0, x1 - x0)}
              height={242}
              fill="transparent"
              onMouseMove={(e) => {
                const svg = (e.currentTarget as SVGRectElement).ownerSVGElement!;
                const r = svg.getBoundingClientRect();
                setHover({ mx: e.clientX - r.left, my: e.clientY - r.top });
              }}
              onMouseLeave={() => setHover(null)}
            />
          </svg>
        )}
        {tip && (
          <div className={styles.chartTip} style={{ left: tip.left, top: tip.top }}>
            <p style={{ margin: 0, color: '#0f172a' }}>{tip.label}</p>
            <p style={{ paddingTop: 4, color: '#2563eb' }}>count : {tip.value}</p>
          </div>
        )}
      </div>
    </>
  );
}
