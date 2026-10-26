import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, contactActions, crumbsFor, personSection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { BEST_TIME, CALLBACK_CATEGORY } from '../../../constants/enquiries';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { CALL_OUTCOMES, useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { badge, dateTime, relativeLong, shortId, statusLabel, todayIso } from '../../../lib/format';
import { addCallbackAttempt, getCallback, rescheduleCallback, resolveCallback, type AttemptOutcome } from '../../../services/enquiries';
import { toast } from '../../../store/uiStore';
import { effectiveCallbackStatus } from '../components/enquiryHelpers';

/** Reference call outcomes → callback attempt outcome enum. */
const OUTCOME_MAP: Record<string, AttemptOutcome> = { Interested: 'answered', 'Not Interested': 'answered', 'Callback Later': 'callback_later', 'No Answer': 'no_answer', 'Wrong Number': 'wrong_number' };
const OUTCOME_LABEL: Record<string, string> = { answered: 'Answered', no_answer: 'No Answer', busy: 'Busy', wrong_number: 'Wrong Number', callback_later: 'Callback Later' };
const SLOT_HOURS: Record<string, number> = { 'Morning (9 AM – 12 PM)': 9, 'Afternoon (12 – 4 PM)': 12, 'Evening (4 – 8 PM)': 16 };

export function CallbackDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['callback', id], queryFn: ({ signal }) => getCallback(id, signal), retry: false });
  const cb = q.data;
  const { nameOf } = useSalesTeam();
  const wf = useWorkflowSections('callback', id, f, cb?.createdAt);
  const lock = useEditLock('callback', id);
  const keys = [['callback', id], ['callbacks']];
  const attempt = useRefreshingMutation((body: Parameters<typeof addCallbackAttempt>[1]) => addCallbackAttempt(id, body), keys);
  const resolve = useRefreshingMutation((notes: string) => resolveCallback(id, notes), keys);
  const resched = useRefreshingMutation((body: Parameters<typeof rescheduleCallback>[1]) => rescheduleCallback(id, body), keys);

  const state = detailStateOf(q);
  if (state !== 'ok' || !cb) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/enquiries/callbacks" />;

  const eff = effectiveCallbackStatus(cb);
  const overdue = eff === 'overdue';
  const best = (cb.bestTimePreference && BEST_TIME[cb.bestTimePreference]) || '';

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/enquiries/callbacks"
      crumbs={crumbsFor('Enquiries', '/admin/enquiries/buy', 'Callbacks', '/admin/enquiries/callbacks', cb.callerName)}
      title={cb.callerName}
      badges={[statusBadge(eff), { text: cb.userType.toUpperCase(), tone: cb.userType === 'nri' ? 'indigo' : 'muted' }]}
      meta={shortId(cb.id, cb.referenceId) + ' • ' + cb.reason + ' • Requested ' + relativeLong(cb.createdAt)}
      hActions={contactActions({ name: cb.callerName, phone: cb.phone, email: cb.email, property: cb.propertyTitle, entity: { type: 'callback', id: cb.id } })}
      banners={[
        lock,
        overdue ? { text: '🔴 This callback is overdue', tone: 'error' } : null,
        cb.status === 'missed' ? { text: 'This callback was marked as missed', tone: 'warn' } : null,
        cb.attemptCount >= 3 ? { text: 'Persistent follow-up needed — ' + cb.attemptCount + ' attempts so far', tone: 'warn' } : null,
      ]}
      main={[
        {
          title: 'Callback Details',
          fields: [
            { label: 'Source', value: statusLabel(cb.source) + (cb.sourceScreen ? ' · ' + cb.sourceScreen : '') },
            { label: 'Best time', value: best },
            { label: 'Preferred callback', value: cb.preferredTime ? dateTime(cb.preferredTime) : '' },
            { label: 'SLA deadline', value: cb.slaDeadline ? dateTime(cb.slaDeadline) : '', color: overdue ? '#dc2626' : '#0f172a', strong: true },
            { label: 'Property', value: cb.propertyTitle },
          ],
          actions: cb.propertyId ? [btn('View Property', () => navigate('/admin/properties/' + cb.propertyId), 'link')] : [],
        },
        {
          title: 'Log Call Attempt',
          rows: cb.attempts.map((a, i) => ({ key: a.id, title: 'Attempt ' + (i + 1) + ' · ' + (OUTCOME_LABEL[a.outcome] || statusLabel(a.outcome)), sub: (a.notes ? a.notes + '\n' : '') + (a.at ? dateTime(a.at) : ''), badges: [badge(OUTCOME_LABEL[a.outcome] || statusLabel(a.outcome), a.outcome === 'answered' ? 'green' : a.outcome === 'wrong_number' ? 'orange' : 'muted')] })),
          empty: cb.attempts.length ? '' : 'No call attempts yet — log your first call',
          chips: CALL_OUTCOMES.map((o) => ({ label: o, on: f.str('call.out') === o, onClick: () => { f.set('call.out', o); f.set('call.err', ''); } })),
          form: [f.inp('call.dur', 'Duration (minutes)', { type: 'number', placeholder: '5' }), f.inp('call.notes', 'Notes', { type: 'textarea', placeholder: 'What was discussed?' })],
          banners: f.str('call.err') ? [{ text: 'Select an outcome', tone: 'error' }] : [],
          actions: [
            btn('+ Log Call', () => {
              const out = f.str('call.out');
              if (!out) return f.set('call.err', '1');
              const dur = Number(f.str('call.dur')) || 0;
              const notes = [OUTCOME_MAP[out] === 'answered' ? out : '', dur ? dur + ' min' : '', f.str('call.notes')].filter(Boolean).join(' · ');
              attempt.mutate({ outcome: OUTCOME_MAP[out], notes: notes || undefined }, { onSuccess: () => { f.clear('call.'); toast('📞 Call logged'); } });
            }, 'primary', { loading: attempt.isPending }),
          ],
        },
        {
          title: 'Resolution',
          banners: cb.status === 'resolved' ? [{ text: '✅ Resolved — ' + (cb.resolutionNotes || 'No notes'), tone: 'success' }] : [],
          formCols: 1,
          form: cb.status === 'resolved' ? [] : [f.inp('res', 'What was discussed / resolved', { type: 'textarea', required: true })],
          actions: cb.status === 'resolved' ? [] : [btn('Confirm Resolve', () => { if (!f.need({ res: 'Add resolution notes' })) return; resolve.mutate(f.str('res'), { onSuccess: () => { f.set('res', ''); toast('✅ Resolved'); } }); }, 'green', { loading: resolve.isPending })],
        },
        wf.notes(),
      ]}
      side={[
        personSection('Caller Info', { name: cb.callerName, phone: cb.phone, email: cb.email }, [], cb.callerId ? '/admin/users/' + cb.callerId : null, 'View Profile', navigate),
        {
          title: 'Callback Info',
          cols: 1,
          fields: [
            { label: 'Category', value: CALLBACK_CATEGORY[cb.category] || statusLabel(cb.category) },
            { label: 'Created', value: dateTime(cb.createdAt) },
            { label: 'Assigned to', value: nameOf(cb.assignedTo, cb.assignedName) || cb.assignedName || 'Unassigned' },
            { label: 'Attempts', value: cb.attemptCount },
          ],
          banners: [{ text: 'Reassignment is disabled until the callback assignment endpoint is available.', tone: 'muted' }],
          actions: [btn('Reassign', undefined, 'outline', { disabled: true, title: 'Endpoint pending' })],
        },
        {
          title: 'Quick Actions',
          stack: true,
          actions: [
            btn('🔄 Reschedule', () =>
              modal.open({
                title: 'Reschedule callback',
                fields: [
                  { key: 'day', label: 'New date', type: 'date', min: todayIso(), default: todayIso(), required: true },
                  { key: 'slot', label: 'New slot', type: 'select', options: Object.keys(SLOT_HOURS), required: true },
                  { key: 'reason', label: 'Reason', required: true, placeholder: 'e.g. Caller asked to call in the evening' },
                ],
                submit: 'Reschedule',
                onSubmit: async (x) => {
                  const d = new Date(String(x.day) + 'T00:00:00');
                  d.setHours(SLOT_HOURS[String(x.slot)] ?? 9);
                  await resched.mutateAsync({ preferredTime: d.toISOString(), reason: String(x.reason), notes: String(x.slot) });
                  toast('🔄 Callback rescheduled');
                },
              }),
            ),
            cb.status === 'missed' || cb.status === 'resolved'
              ? null
              : btn('⚠️ Mark Missed', () =>
                  attempt.mutate({ outcome: 'no_answer', notes: 'Marked missed from dashboard' }, { onSuccess: (r) => toast(r.status === 'missed' ? 'Callback marked as missed' : '📞 Missed attempt logged — status: ' + statusLabel(r.status)) }), 'red'),
          ],
        },
        wf.activity(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
