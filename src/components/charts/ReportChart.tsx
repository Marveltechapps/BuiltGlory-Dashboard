import { useElementWidth } from '../../hooks/useDomUtils';
import { arcPath, CHART_COLORS, niceStep } from './chartMath';

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

interface CartesianProps {
  kind: 'bar' | 'line';
  categories: string[];
  series: ChartSeries[];
  format: (v: number) => string;
}

interface DonutProps {
  kind: 'donut';
  items: Array<{ label: string; value: number }>;
  format: (v: number) => string;
}

export type ReportChartProps = { title: string } & (CartesianProps | DonutProps);

const X0 = 48;
const Y0 = 8;
const Y1 = 250;

/** Report chart card: grouped bars, line with dots, or donut — the reference Reports SVG geometry. */
export function ReportChart(p: ReportChartProps) {
  const { ref, width: W } = useElementWidth<HTMLDivElement>();
  let body: React.ReactNode = null;
  let legend: Array<{ label: string; color: string }> = [];
  let noData = false;
  let summary = '';

  if (p.kind === 'donut') {
    const data = p.items.filter((d) => d.value > 0);
    const total = data.reduce((t, d) => t + d.value, 0);
    noData = total === 0;
    const cx = W / 2;
    const pad = data.length > 1 ? 2 : 0;
    const real = 360 - pad * data.length;
    let a = 0;
    legend = data.map((d, i) => ({ label: d.label + ' · ' + p.format(d.value), color: CHART_COLORS[i % CHART_COLORS.length]! }));
    summary = p.title + ': ' + legend.map((l) => l.label).join(', ');
    body =
      W > 0 &&
      data.map((d, i) => {
        const ang = data.length === 1 ? 359.999 : (d.value / total) * real;
        const path = arcPath(cx, 135, 60, 100, a, a + ang);
        a += ang + pad;
        return (
          <path key={d.label} d={path} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#ffffff">
            <title>{d.label + ': ' + p.format(d.value)}</title>
          </path>
        );
      });
  } else {
    const { categories: cats, series } = p;
    const x1 = Math.max(X0 + 10, W - 8);
    const max = Math.max(0, ...series.flatMap((s) => s.values));
    noData = max === 0;
    const step = niceStep(max);
    const top = step * 4;
    const band = (x1 - X0) / Math.max(1, cats.length);
    const yOf = (v: number) => Y1 - (v / top) * (Y1 - Y0);
    legend = series.map((s) => ({ label: s.name, color: s.color }));
    summary = p.title + ': ' + series.map((s) => s.name + ' ' + s.values.map((v, i) => cats[i] + ' ' + p.format(v)).join(', ')).join('; ');
    const gap = band * 0.2;
    const bw = (band - gap * 2) / Math.max(1, series.length);
    body = (
      <>
        {[0, 1, 2, 3, 4].map((i) => <line key={'g' + i} x1={X0} x2={x1} y1={yOf(i * step)} y2={yOf(i * step)} stroke="#e2e8f0" strokeDasharray="3 3" />)}
        {[0, 1, 2, 3, 4].map((i) => <text key={'y' + i} x={40} y={yOf(i * step)} dy="0.355em" textAnchor="end" fontSize={12} fill="#94a3b8">{p.format(i * step)}</text>)}
        {cats.map((c, i) => <text key={'x' + i} x={X0 + band * i + band / 2} y={258} dy="0.71em" textAnchor="middle" fontSize={12} fill="#94a3b8">{c}</text>)}
        <line x1={X0} x2={x1} y1={Y1} y2={Y1} stroke="#94a3b8" />
        {W > 0 && p.kind === 'bar' &&
          cats.flatMap((c, i) =>
            series.map((s, j) => {
              const v = s.values[i] ?? 0;
              return (
                <rect key={c + s.name} x={X0 + band * i + gap + bw * j} y={yOf(v)} width={Math.max(1, bw - 2)} height={Math.max(0, Y1 - yOf(v))} rx={4} fill={s.color}>
                  <title>{c + ' · ' + s.name + ': ' + p.format(v)}</title>
                </rect>
              );
            }),
          )}
        {W > 0 && p.kind === 'line' &&
          series.map((s) => (
            <g key={s.name}>
              <path d={s.values.map((v, i) => (i ? 'L' : 'M') + (X0 + band * i + band / 2) + ',' + yOf(v)).join('')} fill="none" stroke={s.color} strokeWidth={2.5} />
              {s.values.map((v, i) => (
                <circle key={i} cx={X0 + band * i + band / 2} cy={yOf(v)} r={4} fill={s.color}>
                  <title>{cats[i] + ' · ' + p.format(v)}</title>
                </circle>
              ))}
            </g>
          ))}
      </>
    );
  }

  return (
    <div style={{ minWidth: 0, borderRadius: 16, border: '1px solid rgba(226,232,240,0.8)', background: '#ffffff', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <h3 style={{ fontSize: 16, lineHeight: 1, fontWeight: 600 }}>{p.title}</h3>
      </div>
      <div style={{ padding: 20 }}>
        <div ref={ref} role="img" aria-label={summary} style={{ position: 'relative', width: '100%', height: 280 }}>
          <svg width={W} height={280} style={{ display: 'block', overflow: 'visible' }}>{body}</svg>
          {noData && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>No data for selected period</div>
          )}
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, fontSize: 12 }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: l.color }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
