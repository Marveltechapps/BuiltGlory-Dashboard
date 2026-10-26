import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { emptyFor, matches, readView, tableStateOf, writeView } from '../../../components/tables/listState';
import { Icon } from '../../../components/ui/Icon';
import { ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { reachOut } from '../../../lib/contact';
import { addDaysIso, badge, initials, parseTimeMinutes, time12, todayIso } from '../../../lib/format';
import { updateVisitStatus, type VisitStatusBody } from '../../../services/enquiries';
import { toast } from '../../../store/uiStore';
import type { Visit } from '../../../types/enquiries';
import { useVisits } from '../hooks/useEnquiries';
import { enqBadge } from './enquiryHelpers';
import { RescheduleVisitModal } from './RescheduleVisitModal';
import styles from './Enquiries.module.css';

const opt = (pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ value, label }));
const dayLabel = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00').toLocaleDateString('en-IN', o);

export function VisitsTab() {
  const navigate = useNavigate();
  const q = useVisits();
  const { nameOf } = useSalesTeam();
  const [search, setSearch] = useState('');
  const [vType, setVType] = useState('all');
  const [vStatus, setVStatus] = useState('all');
  const [vDate, setVDate] = useState('upcoming');
  const [view, setView] = useState(() => readView('visits', 'list'));
  const [week, setWeek] = useState(0);
  const [reschedId, setReschedId] = useState<string | null>(null);
  const statusM = useRefreshingMutation((v: { id: string; body: VisitStatusBody }) => updateVisitStatus(v.id, v.body), [['visits']]);

  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const weekEnd = addDaysIso(today, 6);
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const key = (v: Visit) => v.visitDate + String(parseTimeMinutes(v.visitTime)).padStart(4, '0');
  const all = (q.data?.items ?? []).slice().sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const dateOk = (v: Visit) =>
    vDate === 'today' ? v.visitDate === today : vDate === 'tomorrow' ? v.visitDate === tomorrow : vDate === 'week' ? v.visitDate >= today && v.visitDate <= weekEnd : vDate === 'past' ? v.visitDate < today : vDate === 'upcoming' ? v.visitDate >= today : true;
  const baseOk = (v: Visit) => (vType === 'all' || v.visitType === vType) && (vStatus === 'all' || v.status === vStatus) && matches(search, v.buyerName, v.phone, v.propertyTitle);
  const list = all.filter((v) => baseOk(v) && dateOk(v));
  const slot: Record<string, number> = {};
  all.filter((v) => v.status !== 'cancelled').forEach((v) => (slot[v.visitDate + v.visitTime] = (slot[v.visitDate + v.visitTime] || 0) + 1));
  const overdue = (v: Visit) => (v.status === 'scheduled' || v.status === 'confirmed') && (v.visitDate < today || (v.visitDate === today && parseTimeMinutes(v.visitTime) < nowM));
  const assignee = (v: Visit) => nameOf(v.assignedTo, v.assignedName) || v.assignedName;
  const open = (v: Visit) => () => navigate('/admin/visits/' + v.id);
  const state = tableStateOf(q, list);
  const setViewMode = (v: string) => {
    writeView('visits', v);
    setView(v);
  };

  const setStatus = (v: Visit, status: VisitStatusBody['status'], msg: string) => () => {
    if (status === 'confirmed' && v.visitType === 'virtual' && !v.meetingLink) return toast('Add a meeting link before confirming this visit');
    if (status === 'completed') {
      const saved = v.feedback;
      if (!saved?.buyerInterest || !saved.notes || !saved.nextAction) return toast('Add feedback on the visit before marking it completed.');
      return statusM.mutate({ id: v.id, body: { status, feedback: { buyerInterest: saved.buyerInterest, notes: saved.notes, nextAction: saved.nextAction } } }, { onSuccess: () => toast(msg) });
    }
    statusM.mutate({ id: v.id, body: { status } }, { onSuccess: () => toast(msg) });
  };
  const go = (v: Visit) => {
    if (v.visitType === 'virtual') {
      if (!v.meetingLink) return toast('⚠️ No meeting link added');
      window.open(v.meetingLink, '_blank', 'noopener,noreferrer');
      return toast('🎥 Opening ' + v.meetingLink);
    }
    const dest = [v.propertyTitle, v.propertyAddress].filter(Boolean).join(', ');
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dest), '_blank', 'noopener,noreferrer');
    toast('🗺️ Opening directions to ' + v.propertyTitle);
  };

  const todays = all.filter((v) => v.visitDate === today && v.status !== 'cancelled');
  const rows: Row[] = list.map((v) => ({
    key: v.id,
    onClick: open(v),
    dim: v.status === 'cancelled',
    cells: [
      {
        title: dayLabel(v.visitDate, { weekday: 'short', day: 'numeric', month: 'short' }),
        strong: true,
        sub: time12(v.visitTime),
        flags: [(slot[v.visitDate + v.visitTime] || 0) > 1 && v.status !== 'cancelled' ? { text: '⚠️ Conflict' } : null, overdue(v) ? { text: 'Overdue', bg: '#fee2e2', fg: '#b91c1c' } : null],
      },
      { initials: initials(v.buyerName), title: v.buyerName, strong: true, sub: v.phone },
      { title: v.propertyTitle, wrap: true },
      { badges: [v.visitType === 'virtual' ? badge('Virtual', 'indigo') : badge('Physical', 'muted')] },
      { badges: [enqBadge('visits', v.status)] },
      { title: assignee(v) || '⚠️ Unassigned', color: assignee(v) ? undefined : '#c2410c' },
      {
        actions: [
          v.status === 'scheduled' || v.status === 'rescheduled' ? { label: 'Confirm', variant: 'green', onClick: setStatus(v, 'confirmed', '✅ Visit confirmed') } : null,
          v.status === 'scheduled' || v.status === 'confirmed' || v.status === 'rescheduled' ? { label: 'Complete', onClick: setStatus(v, 'completed', '✔️ Visit marked as completed') } : null,
          v.status === 'scheduled' || v.status === 'confirmed' ? { label: 'Missed', variant: 'red', onClick: setStatus(v, 'missed', '⚠️ Visit marked as missed') } : null,
          v.status !== 'completed' && v.status !== 'cancelled' && v.status !== 'missed' ? { icon: 'calendar-clock', title: 'Reschedule', onClick: () => setReschedId(v.id) } : null,
          { label: 'View', onClick: open(v) },
        ],
      },
    ],
  }));

  const base = new Date(today + 'T12:00:00');
  const dow = (base.getDay() + 6) % 7;
  const monday = addDaysIso(today, -dow + week * 7);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDaysIso(monday, i));
  const resched = all.find((v) => v.id === reschedId);

  return (
    <PageStack>
      <ListHeader
        title="Visits"
        count={String(all.length)}
        search={{ value: search, onChange: setSearch, placeholder: 'Search buyer, phone, property...' }}
        selects={[
          { label: 'Type', value: vType, onChange: setVType, options: opt([['all', 'All types'], ['physical', 'Physical'], ['virtual', 'Virtual']]) },
          { label: 'Status', value: vStatus, onChange: setVStatus, options: opt([['all', 'All statuses'], ['scheduled', 'Scheduled'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['missed', 'Missed']]) },
          { label: 'Date', value: vDate, onChange: setVDate, options: opt([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This Week'], ['upcoming', 'All Upcoming'], ['past', 'Past Visits']]) },
        ]}
        toggle={[
          { label: 'List view', icon: 'list', active: view === 'list', onClick: () => setViewMode('list') },
          { label: 'Calendar view', icon: 'calendar', active: view === 'calendar', onClick: () => setViewMode('calendar') },
        ]}
      />

      {!q.isPending && !q.isError && (
        <div className={styles.today}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 600 }}>Today</p>
            <span style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          {todays.length === 0 && <p style={{ fontSize: 14, lineHeight: '20px', color: '#64748b' }}>No visits today</p>}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {todays.map((v) => {
              const b = enqBadge('visits', v.status);
              return (
                <div key={v.id} className={styles.todayCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ borderRadius: 8, background: '#dbeafe', padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 600, color: '#1e40af' }}>{time12(v.visitTime)}</span>
                    <span style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500, background: b.bg, color: b.fg }}>{b.text}</span>
                  </div>
                  <button type="button" onClick={open(v)} style={{ textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>{v.buyerName}</span>
                    <span className={styles.ellipsis} style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{v.propertyTitle}</span>
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className={styles.miniBtn} onClick={() => reachOut('whatsapp', { name: v.buyerName, to: v.phone, property: v.propertyTitle, entity: { type: 'visit', id: v.id } })}><Icon name="message-circle" size={12} />WhatsApp</button>
                    <button type="button" className={styles.miniBtn} onClick={() => reachOut('email', { name: v.buyerName, to: v.email, property: v.propertyTitle, entity: { type: 'visit', id: v.id } })}><Icon name="mail" size={12} />Email</button>
                    <button type="button" className={styles.miniBtn} onClick={() => go(v)}><Icon name={v.visitType === 'virtual' ? 'video' : 'map-pin'} size={12} />{v.visitType === 'virtual' ? 'Join' : 'Directions'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && state === 'normal' ? (
        <div className={styles.cal}>
          <div className={styles.calHead}>
            <button type="button" className={styles.calNav} aria-label="Previous week" onClick={() => setWeek((w) => w - 1)}><Icon name="chevron-left" size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600 }}>{dayLabel(days[0]!, { day: 'numeric', month: 'short' }) + ' – ' + dayLabel(days[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <button type="button" className="bg-link-btn" style={{ fontSize: 12, lineHeight: '16px', fontWeight: 400 }} onClick={() => setWeek(0)}>Jump to this week</button>
            </div>
            <button type="button" className={styles.calNav} aria-label="Next week" onClick={() => setWeek((w) => w + 1)}><Icon name="chevron-right" size={16} /></button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', minWidth: 840, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {days.map((d) => (
                <div key={d} className={styles.calDay} style={{ background: d === today ? 'rgba(239,246,255,0.6)' : '#ffffff' }}>
                  <p style={{ marginBottom: 8, fontSize: 12, lineHeight: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em', color: d === today ? '#2563eb' : '#64748b' }}>{dayLabel(d, { weekday: 'short', day: 'numeric' })}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {all.filter((v) => v.visitDate === d && baseOk(v)).map((v) => {
                      const b = enqBadge('visits', v.status);
                      return (
                        <button key={v.id} type="button" className={styles.calItem} style={{ background: b.bg, color: b.fg }} onClick={open(v)}>
                          <span style={{ display: 'block', fontSize: 11, lineHeight: '16px', fontWeight: 600 }}>{time12(v.visitTime)} · {v.visitType === 'virtual' ? 'Virtual' : 'Physical'}</span>
                          <span className={styles.ellipsis} style={{ display: 'block', fontSize: 12, lineHeight: '16px' }}>{v.buyerName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <DataTable
          columns={['Visit', 'Buyer', 'Property', 'Type', 'Status', 'Assigned To', 'Actions']}
          rows={rows}
          state={state}
          minWidth="1140px"
          errorTitle="Could not load visits"
          onRetry={() => void q.refetch()}
          empty={emptyFor(all.length, list.length, search, { icon: 'calendar-off', title: 'No visits scheduled', text: 'Property visits from the app appear here' }, () => setSearch(''), () => { setVType('all'); setVStatus('all'); setVDate('upcoming'); })}
        />
      )}
      {resched && <RescheduleVisitModal visit={resched} onClose={() => setReschedId(null)} />}
    </PageStack>
  );
}
