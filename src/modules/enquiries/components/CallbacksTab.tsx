import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { emptyFor, matches, tableStateOf } from '../../../components/tables/listState';
import { Icon } from '../../../components/ui/Icon';
import { InnerTabs, ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { CALLBACK_CATEGORY } from '../../../constants/enquiries';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { callPhone } from '../../../lib/contact';
import { badge, initials, statusLabel } from '../../../lib/format';
import { addCallbackAttempt, resolveCallback } from '../../../services/enquiries';
import { askConfirm, toast } from '../../../store/uiStore';
import type { Callback } from '../../../types/enquiries';
import { useCallbacks } from '../hooks/useEnquiries';
import { callbackPreferred, effectiveCallbackStatus, enqBadge, slaCell, statusTabs } from './enquiryHelpers';
import styles from './Enquiries.module.css';

export function CallbacksTab() {
  const navigate = useNavigate();
  const q = useCallbacks();
  const { team, nameOf } = useSalesTeam();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [assigneeF, setAssigneeF] = useState('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const attempt = useRefreshingMutation((v: { id: string; outcome?: 'no_answer'; notes?: string }) => addCallbackAttempt(v.id, { outcome: v.outcome, notes: v.notes }), [['callbacks']]);
  const resolveMany = useRefreshingMutation((v: { ids: string[]; notes: string }) => Promise.all(v.ids.map((id) => resolveCallback(id, v.notes))), [['callbacks']]);

  const all = (q.data?.items ?? []).slice().sort((a, b) => ((a.slaDeadline || '') < (b.slaDeadline || '') ? -1 : 1));
  const st = effectiveCallbackStatus;
  const list = all.filter((c) => (status === 'all' || st(c) === status) && (assigneeF === 'all' || c.assignedTo === assigneeF) && matches(search, c.callerName, c.phone, c.reason));
  const selIds = Object.keys(selected).filter((k) => selected[k] && list.some((c) => c.id === k));
  const state = tableStateOf(q, list);
  const open = (c: Callback) => () => navigate('/admin/callbacks/' + c.id);

  const rows: Row[] = list.map((c) => ({
    key: c.id,
    onClick: open(c),
    checked: !!selected[c.id],
    onCheck: () => setSelected((s) => ({ ...s, [c.id]: !s[c.id] })),
    cells: [
      { initials: initials(c.callerName), title: c.callerName, strong: true, sub: c.phone, tags: [badge(c.userType.toUpperCase(), c.userType === 'nri' ? 'indigo' : 'muted')] },
      { title: c.reason, sub: CALLBACK_CATEGORY[c.category] || statusLabel(c.category), wrap: true },
      { title: c.propertyTitle || '—', muted: true, wrap: true },
      { title: callbackPreferred(c), muted: true },
      slaCell({ ...c, status: st(c) }),
      { badges: [enqBadge('callbacks', st(c))] },
      { title: String(c.attemptCount), sub: c.attemptCount >= 3 ? 'Persistent follow-up' : '' },
      { title: nameOf(c.assignedTo, c.assignedName) || c.assignedName || 'Unassigned' },
      {
        actions: [
          {
            icon: 'phone',
            title: 'Call',
            onClick: () => {
              callPhone(c.callerName, c.phone);
              attempt.mutate({ id: c.id });
            },
          },
          c.status !== 'resolved'
            ? {
                label: 'Mark Resolved',
                variant: 'green',
                onClick: () =>
                  askConfirm({
                    title: 'Resolve callback?',
                    message: c.callerName + ' · ' + c.reason,
                    input: { label: 'What was discussed / resolved', placeholder: 'Summary of the call', required: true },
                    confirmLabel: 'Confirm Resolve',
                    tone: 'green',
                    onConfirm: async ({ value }) => {
                      await resolveMany.mutateAsync({ ids: [c.id], notes: value });
                      toast('✅ Resolved');
                    },
                  }),
              }
            : null,
          c.status !== 'resolved' && c.status !== 'missed'
            ? {
                label: 'Mark Missed',
                variant: 'red',
                onClick: () =>
                  attempt.mutate(
                    { id: c.id, outcome: 'no_answer', notes: 'Marked missed from dashboard' },
                    { onSuccess: (r) => toast(r.status === 'missed' ? 'Callback marked as missed' : '📞 Missed attempt logged — status: ' + statusLabel(r.status)) },
                  ),
              }
            : null,
        ],
      },
    ],
  }));

  return (
    <PageStack>
      <ListHeader
        title="Callbacks"
        count={String(all.length)}
        search={{ value: search, onChange: setSearch, placeholder: 'Search caller, phone, reason...' }}
        selects={[{ label: 'Assignee', value: assigneeF, onChange: setAssigneeF, options: [{ value: 'all', label: 'All assignees' }].concat(team.map((m) => ({ value: m.id, label: m.name }))) }]}
      />
      <InnerTabs tabs={statusTabs('callbacks', all, st, status, (k) => { setStatus(k); setSelected({}); })} />
      {selIds.length > 0 && (
        <div className={styles.bulk}>
          <span style={{ fontWeight: 500, color: '#1d4ed8' }}>{selIds.length} selected</span>
          <button
            type="button"
            style={{ display: 'inline-flex', height: 32, alignItems: 'center', borderRadius: 8, background: '#2563eb', padding: '0 12px', fontSize: 12, fontWeight: 500, color: '#ffffff' }}
            onClick={() =>
              askConfirm({
                title: 'Resolve ' + selIds.length + ' callbacks?',
                input: { label: 'Resolution notes (applied to all)', placeholder: 'e.g. Spoke with caller, query answered', required: true },
                confirmLabel: 'Resolve all',
                tone: 'green',
                onConfirm: async ({ value }) => {
                  await resolveMany.mutateAsync({ ids: selIds, notes: value });
                  setSelected({});
                  toast('✅ ' + selIds.length + ' callbacks resolved');
                },
              })
            }
          >
            Resolve all
          </button>
          <button type="button" className="bg-link-btn" style={{ fontSize: 12 }} onClick={() => setSelected({})}>Clear selection</button>
        </div>
      )}
      {!q.isPending && !q.isError && all.length > 0 && !all.some((c) => st(c) === 'pending' || st(c) === 'overdue') && (
        <div className={styles.done}>
          <span style={{ display: 'inline-flex', color: '#16a34a' }}><Icon name="check-circle" size={20} /></span>
          <div>
            <p style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#15803d' }}>All callbacks resolved!</p>
            <p style={{ fontSize: 12, lineHeight: '16px', color: '#15803d' }}>Great job staying on top of requests</p>
          </div>
        </div>
      )}
      <DataTable
        columns={['Caller', 'Reason & Category', 'Property', 'Preferred Time', 'SLA', 'Status', 'Attempts', 'Assigned', 'Actions']}
        rows={rows}
        state={state}
        minWidth="1280px"
        selectable
        allChecked={list.length > 0 && selIds.length === list.length}
        onToggleAll={() => setSelected(selIds.length === list.length ? {} : Object.fromEntries(list.map((c) => [c.id, true])))}
        errorTitle="Could not load callbacks"
        onRetry={() => void q.refetch()}
        empty={emptyFor(all.length, list.length, search, { icon: 'phone-off', title: 'No callbacks yet', text: 'Callback requests from the app appear here' }, () => setSearch(''), () => { setStatus('all'); setAssigneeF('all'); })}
      />
    </PageStack>
  );
}
