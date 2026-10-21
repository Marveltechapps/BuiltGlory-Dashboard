import { BEST_TIME, ENQ_STATUS, ENQ_TABS, VISIT_PREF } from '../../../constants/enquiries';
import { badge, date, dateTime, statusLabel } from '../../../lib/format';
import type { InnerTab } from '../../../components/ui/ListHeader';
import type { Cell } from '../../../components/tables/DataTable';
import type { BuyEnquiry, Callback } from '../../../types/enquiries';

export const enqBadge = (tab: string, status: string) => {
  const m = ENQ_STATUS[tab]?.[status] ?? [statusLabel(status), 'muted'];
  return badge(m[0], m[1]);
};

/** "Label (count)" status tabs for a list. */
export function statusTabs<T>(tab: string, list: T[], getStatus: (x: T) => string, active: string, onSelect: (k: string) => void): InnerTab[] {
  return (ENQ_TABS[tab] || []).map((k) => {
    const n = k === 'all' ? list.length : list.filter((x) => getStatus(x) === k).length;
    return { key: k, label: (k === 'all' ? 'All' : (ENQ_STATUS[tab]?.[k]?.[0] ?? statusLabel(k))) + ' (' + n + ')', active: active === k, onClick: () => onSelect(k) };
  });
}

export const statusOptions = (tab: string, allLabel = 'All statuses') =>
  [{ value: 'all', label: allLabel }].concat(Object.entries(ENQ_STATUS[tab] || {}).map(([value, [label]]) => ({ value, label })));

export const visitPrefLabel = (e: Pick<BuyEnquiry, 'preferredVisitTime' | 'preferredVisitDate' | 'preferredVisitTimeSlot'>) => {
  if (e.preferredVisitTime === 'custom') {
    const parts = [e.preferredVisitDate ? date(e.preferredVisitDate) : '', e.preferredVisitTimeSlot || ''].filter(Boolean);
    return parts.length ? parts.join(' · ') : VISIT_PREF.custom!;
  }
  return (e.preferredVisitTime && VISIT_PREF[e.preferredVisitTime]) || 'Flexible';
};

const H = 36e5;

export const callbackPreferred = (c: Callback) => (c.bestTimePreference && BEST_TIME[c.bestTimePreference]) || (c.preferredTime ? dateTime(c.preferredTime) : '—');

/** Effective status: SLA past due and not resolved → overdue (same rule as the original admin). */
export const effectiveCallbackStatus = (c: Callback) =>
  c.status !== 'resolved' && c.status !== 'missed' && c.slaDeadline && Date.parse(c.slaDeadline) < Date.now() ? 'overdue' : c.status;

export function slaCell(c: Callback): Cell {
  if (c.status === 'resolved' || !c.slaDeadline) return { title: '—', muted: true };
  const rem = Date.parse(c.slaDeadline) - Date.now();
  if (rem <= 0 || c.status === 'overdue') return { title: 'OVERDUE', color: '#dc2626', bold: true, sub: Math.max(1, Math.round(-rem / H)) + 'h past SLA' };
  const hh = Math.floor(rem / H);
  const mm = Math.floor((rem % H) / 60000);
  return { title: hh + 'h ' + mm + 'm left', color: rem < H ? '#d97706' : '#16a34a', strong: true };
}
