import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf, isObjectId } from '../../../components/detail/detailState';
import { btn, contactActions, personSection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useEditLock } from '../../../hooks/useEditLock';
import { useLiveSupport } from '../../../hooks/useLiveSupport';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSession } from '../../../hooks/useSession';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { dateTime, fillVars, initials, relativeLong, statusLabel } from '../../../lib/format';
import { listAdmins } from '../../../services/admins';
import { listTemplates } from '../../../services/messaging';
import { sendSupportMessage } from '../../../lib/realtime';
import { asRaw } from '../../../lib/raw';
import { closeTicket, getTicket, mapTicket, markTicketRead, reopenTicket, respondToTicket, updateTicket, type TicketUpdate } from '../../../services/support';
import { askConfirm, toast } from '../../../store/uiStore';
import { hasAdminReply } from '../components/supportHelpers';

const H = 36e5;

export function SupportTicketDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['support-ticket', id], queryFn: ({ signal }) => getTicket(id, signal), retry: false });
  const t = q.data;
  // Assignee directory: sales-team is readable by staff; full admin list needs admin.access.manage.
  const { can } = useSession();
  const canListAdmins = can('admin.access.manage');
  const adminsQ = useQuery({ queryKey: ['admins'], queryFn: ({ signal }) => listAdmins(signal), retry: false, enabled: canListAdmins });
  const { team } = useSalesTeam();
  const tplQ = useQuery({ queryKey: ['message-templates'], queryFn: ({ signal }) => listTemplates(signal) });
  const wf = useWorkflowSections('support_ticket', id, f, t?.createdAt);
  const lock = useEditLock('support_ticket', id);
  useLiveSupport(isObjectId(id) ? id : undefined);
  const keys = [['support-ticket', id], ['support-tickets']];
  const respond = useRefreshingMutation(async (b: TicketUpdate) => {
    if (q.data?.channel === 'live_chat' && b.message) {
      try {
        return mapTicket(asRaw(await sendSupportMessage(id, b.message)));
      } catch {
        return respondToTicket(id, b);
      }
    }
    return respondToTicket(id, b);
  }, keys);
  const update = useRefreshingMutation((b: TicketUpdate) => updateTicket(id, b), keys);
  const close = useRefreshingMutation(() => closeTicket(id), keys);
  const reopen = useRefreshingMutation(() => reopenTicket(id), keys);

  useEffect(() => {
    if (isObjectId(id)) void markTicketRead(id).catch(() => undefined);
  }, [id]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !t) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/settings/support" nfTitle="Ticket not found" />;

  const age = (Date.now() - Date.parse(t.createdAt)) / H;
  const replied = hasAdminReply(t);
  const firstReply = t.responses.find((r) => r.responderType !== 'customer');
  // Assignees: prefer admin directory when permitted; otherwise sales-team staff list.
  const people = (canListAdmins && adminsQ.data?.length
    ? adminsQ.data.map((a) => ({ id: a.id, name: a.name, role: a.role }))
    : team.map((m) => ({ id: m.id, name: m.name, role: m.role })));
  const nameOf = (pid: string | null) => (pid ? people.find((p) => p.id === pid)?.name : undefined);
  const assigned = t.assignedToName || nameOf(t.assignedTo) || (t.assignedTo ? 'Assigned' : 'Unassigned');
  const tpls = tplQ.data ?? [];
  const setField = (b: TicketUpdate, msg: string) => update.mutate(b, { onSuccess: () => toast(msg) });

  const reply = () => {
    const txt = f.str('reply').trim();
    if (!txt) return void f.fail('reply', 'Type a reply');
    respond.mutate({ message: txt, ...(t.status === 'open' ? { status: 'in_progress' as const } : {}) }, { onSuccess: () => { f.set('reply', ''); toast('✅ Reply sent'); } });
  };

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/settings/support"
      crumbs={[{ label: 'Back', path: '/admin/settings/support' }, { label: 'Support Tickets', path: '/admin/settings/support' }, { label: t.referenceId }]}
      title={t.subject}
      badges={[statusBadge(t.status), statusBadge(t.priority, statusLabel(t.priority)), t.channel === 'live_chat' ? { text: 'Live Chat', tone: 'teal' } : null]}
      meta={t.referenceId + ' • ' + t.userName + ' • Created ' + relativeLong(t.createdAt)}
      banners={[
        lock,
        t.priority === 'urgent' && !replied && age > 24 && t.status !== 'closed' ? { text: 'Urgent ticket overdue — no response in 24+ hours', tone: 'error' } : null,
        t.status === 'closed' ? { text: 'This ticket is closed', tone: 'muted', actions: [{ label: 'Reopen', onClick: () => reopen.mutate(undefined, { onSuccess: () => toast('Ticket reopened') }) }] } : null,
        !replied && age > 48 && t.status !== 'closed' ? { text: 'No response 48h+', tone: 'warn' } : null,
      ]}
      hActions={contactActions({ name: t.userName, phone: t.phone, email: t.email, callLabel: 'Call User', entity: { type: 'support_ticket', id: t.id } })}
      main={[
        { title: 'Ticket Details', fields: [{ label: 'Category', value: statusLabel(t.category) }, { label: 'Subject', value: t.subject, strong: true }], text: t.description || 'No description provided' },
        {
          title: 'Conversation',
          rows: [
            { key: 'origin', title: t.userName, sub: (t.description || t.subject) + '\n' + dateTime(t.createdAt), initials: initials(t.userName) },
            ...t.responses.map((r) => ({ key: r.id, title: r.author + (r.responderType === 'admin' ? ' (Admin)' : ''), sub: r.message + '\n' + dateTime(r.at), initials: initials(r.author) })),
          ],
          banners: t.responses.length ? [] : [{ text: 'No messages yet — Be the first to respond', tone: 'muted' }],
          form:
            t.status === 'closed'
              ? []
              : [
                  f.inp('tpl', 'Use Template', { type: 'select', options: tpls.map((x) => ({ value: x.id, label: x.name })), placeholder: 'Select template' }),
                  f.inp('reply', 'Reply', { type: 'textarea', placeholder: 'Type your reply...', full: true }),
                ],
          actions:
            t.status === 'closed'
              ? []
              : [
                  btn('Insert template', () => {
                    const x = tpls.find((y) => y.id === f.str('tpl'));
                    if (!x) return toast('Select a template first');
                    f.set('reply', fillVars(x.body, { name: t.userName.split(' ')[0], property: 'your property' }));
                  }),
                  btn('Send', reply, 'primary', { loading: respond.isPending }),
                ],
        },
        wf.callLog(),
        wf.notes('Notes', 'Internal notes only — not visible to users'),
      ]}
      side={[
        personSection('User Info', { name: t.userName, phone: t.phone, email: t.email }, [], t.userId ? '/admin/users/' + t.userId : null, 'View User Profile →', navigate),
        {
          title: 'Ticket Info',
          cols: 1,
          fields: [
            { label: 'Created', value: dateTime(t.createdAt) },
            { label: 'Last Updated', value: relativeLong(t.updatedAt) },
            { label: 'Assigned To', value: assigned },
            { label: 'Priority', value: statusLabel(t.priority) },
            { label: 'Response Time', value: firstReply ? Math.max(1, Math.round((Date.parse(firstReply.at) - Date.parse(t.createdAt)) / H)) + ' hrs' : 'Awaiting first response' },
          ],
          chips: (['open', 'in_progress', 'resolved', 'closed'] as const).map((st) => ({ label: statusLabel(st), on: t.status === st, onClick: () => st !== t.status && setField({ status: st }, 'Status updated') })),
        },
        { title: 'Priority', chips: (['low', 'medium', 'high', 'urgent'] as const).map((p) => ({ label: statusLabel(p), on: t.priority === p, onClick: () => p !== t.priority && setField({ priority: p }, 'Priority updated') })) },
        {
          title: 'Quick Actions',
          stack: true,
          actions: [
            t.status !== 'resolved' && t.status !== 'closed'
              ? btn('✅ Mark Resolved', () => askConfirm({ title: 'Mark as resolved?', confirmLabel: 'Mark Resolved', tone: 'green', onConfirm: () => update.mutateAsync({ status: 'resolved' }).then(() => toast('✅ Ticket resolved')) }), 'green')
              : null,
            btn('🔄 Reassign', () =>
              modal.open({
                title: 'Reassign ticket',
                fields: [{ key: 'w', label: 'Assign to', type: 'select', options: people.map((p) => ({ value: p.id, label: p.name })), required: true, default: t.assignedTo || '' }],
                onSubmit: (v) => update.mutateAsync({ assignedTo: String(v.w) }).then(() => toast('🔄 Reassigned to ' + (nameOf(String(v.w)) || 'team member'))),
              })),
            btn('⬆️ Escalate', () =>
              modal.open({
                title: 'Escalate ticket',
                fields: [
                  { key: 'w', label: 'Escalate to', type: 'select', options: people.filter((p) => ['super_admin', 'admin', 'sales_manager'].includes(p.role)).map((p) => ({ value: p.id, label: p.name })), placeholder: 'Select assignee', required: true },
                  { key: 'r', label: 'Reason', type: 'textarea', required: true },
                ],
                submit: 'Confirm Escalation',
                onSubmit: (v) =>
                  update.mutateAsync({ escalation: { targetAssignee: String(v.w), reason: String(v.r).trim() }, assignedTo: String(v.w), priority: 'urgent' }).then(() => toast('⬆️ Escalated to ' + (nameOf(String(v.w)) || 'team member'))),
              })),
            t.status !== 'closed'
              ? btn('🔒 Close Ticket', () => askConfirm({ title: 'Close ticket?', confirmLabel: 'Close Ticket', tone: 'destructive', onConfirm: () => close.mutateAsync().then(() => toast('🔒 Ticket closed')) }), 'red')
              : null,
          ],
        },
        wf.activity(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
