/** Chart geometry helpers ported from the reference overview (recharts-like monotone line + donut arcs). */

export function niceStep(max: number) {
  if (max <= 0) return 1;
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const s = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return Math.max(1, s);
}

export function monotonePath(pts: Array<[number, number]>) {
  const n = pts.length;
  if (n === 0) return '';
  const p = (i: number) => pts[i]!;
  if (n === 1) return 'M' + p(0)[0] + ',' + p(0)[1];
  if (n === 2) return 'M' + p(0)[0] + ',' + p(0)[1] + 'L' + p(1)[0] + ',' + p(1)[1];
  const sign = (x: number) => (x < 0 ? -1 : 1);
  const t: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const h0 = p(i)[0] - p(i - 1)[0];
    const h1 = p(i + 1)[0] - p(i)[0];
    const s0 = (p(i)[1] - p(i - 1)[1]) / h0;
    const s1 = (p(i + 1)[1] - p(i)[1]) / h1;
    const q = (s0 * h1 + s1 * h0) / (h0 + h1);
    t[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
  }
  const end = (i: number, j: number, ti: number) => {
    const h = p(j)[0] - p(i)[0];
    const s = (p(j)[1] - p(i)[1]) / h;
    return h ? (3 * s - ti) / 2 : ti;
  };
  t[0] = end(0, 1, t[1]!);
  t[n - 1] = end(n - 2, n - 1, t[n - 2]!);
  let d = 'M' + p(0)[0] + ',' + p(0)[1];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = p(i);
    const [x1, y1] = p(i + 1);
    const dx = (x1 - x0) / 3;
    d += 'C' + (x0 + dx) + ',' + (y0 + dx * t[i]!) + ',' + (x1 - dx) + ',' + (y1 - dx * t[i + 1]!) + ',' + x1 + ',' + y1;
  }
  return d;
}

export function arcPath(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number) {
  const rad = Math.PI / 180;
  const pt = (r: number, a: number) => (cx + r * Math.cos(a * rad)).toFixed(3) + ',' + (cy - r * Math.sin(a * rad)).toFixed(3);
  const large = a1 - a0 > 180 ? 1 : 0;
  return 'M' + pt(ro, a0) + 'A' + ro + ',' + ro + ',0,' + large + ',0,' + pt(ro, a1) + 'L' + pt(ri, a1) + 'A' + ri + ',' + ri + ',0,' + large + ',1,' + pt(ri, a0) + 'Z';
}

export const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7', '#ef4444', '#64748b'];

export function labelOf(value: string | undefined) {
  const n = String(value || '').replace(/_/g, ' ').trim();
  if (!n) return 'Other';
  return n.charAt(0).toUpperCase() + n.slice(1);
}
