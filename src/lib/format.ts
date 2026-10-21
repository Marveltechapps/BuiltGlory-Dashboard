import { ACQ_STAGES, SALES_STAGES, STATUS_TONES, TONE, TYPE_LABELS } from '../constants/labels';

export function price(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (n >= 1e3) return '₹' + (n / 1e3).toFixed(2) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}

export const inr = (n: number | null | undefined) => '₹' + (Number(n) || 0).toLocaleString('en-IN');
export const typeLabel = (t: string | null | undefined) => (t ? TYPE_LABELS[t] || statusLabel(t) : '');
export const acqStage = (v: string) => (ACQ_STAGES.find((s) => s[0] === v) || [v, statusLabel(v)])[1];
export const salesStage = (v: string) => (SALES_STAGES.find((s) => s[0] === v) || [v, statusLabel(v)])[1];
export const statusLabel = (s: string | null | undefined) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function date(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export const initials = (name: string | null | undefined) =>
  String(name || '').split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export const num = (n: number | null | undefined) => new Intl.NumberFormat('en-IN').format(Number(n) || 0);

function minutesAgo(v: string | number | Date): number | null {
  const then = new Date(v).getTime();
  if (isNaN(then)) return null;
  return Math.floor(Math.max(0, Date.now() - then) / 60000);
}

export function relative(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '';
  const min = minutesAgo(v);
  if (min == null) return String(v);
  if (min < 1) return 'Just now';
  if (min < 60) return min + ' min ago';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' hr ago';
  const d = Math.floor(h / 24);
  return d + ' day' + (d > 1 ? 's' : '') + ' ago';
}

export function relativeLong(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '';
  const min = minutesAgo(v);
  if (min == null) return String(v);
  if (min < 1) return 'Just now';
  if (min < 60) return min + ' min ago';
  const h = Math.floor(min / 60);
  if (h < 24) return h + (h > 1 ? ' hours ago' : ' hour ago');
  const d = Math.floor(h / 24);
  return d + (d > 1 ? ' days ago' : ' day ago');
}

const ymdOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const todayIso = () => ymdOf(new Date());
export const isoDay = (v: string | number | Date | null | undefined) => {
  if (v == null || v === '') return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : ymdOf(d);
};
export function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return ymdOf(d);
}

export function parseTimeMinutes(value: string | null | undefined): number {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (!m[3]) h = Number(m[1]);
  else if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

/** "14:30" → "2:30 PM"; values already in 12h form pass through. */
export function time12(value: string | null | undefined): string {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/am|pm/i.test(v)) return v;
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return v;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return (h % 12 || 12) + ':' + m[2] + ' ' + suffix;
}

/** "2:30 PM" → "14:30" (24h value the visits API stores). */
export function time24(value: string): string {
  const mins = parseTimeMinutes(value);
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
}

export function daysSince(v: string | null | undefined): number {
  if (!v) return 0;
  const t = Date.parse(v);
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 864e5));
}

export interface BadgeSpec {
  text: string;
  bg: string;
  fg: string;
}

export function badge(text: string, tone?: string): BadgeSpec {
  const t = TONE[tone || 'muted'] || TONE.muted!;
  return { text, bg: t[0], fg: t[1] };
}

/** Status badge using the shared status → tone map. */
export const statusBadge = (status: string | null | undefined, label?: string) => badge(label || statusLabel(status), STATUS_TONES[status || ''] || 'muted');

/** Record id shown in tables: backend reference id, falling back to the last 6 chars of the Mongo id. */
export const shortId = (id: string | null | undefined, ref?: string | null) => ref || (id ? String(id).slice(-6).toUpperCase() : '');

export const fillVars = (str: string, v: Record<string, string | number | undefined>) =>
  String(str || '').replace(/\{(\w+)\}/g, (m, k: string) => (v[k] != null ? String(v[k]) : m));

export const isHttpsUrl = (v: string | null | undefined) => !v || /^https:\/\//.test(v);
