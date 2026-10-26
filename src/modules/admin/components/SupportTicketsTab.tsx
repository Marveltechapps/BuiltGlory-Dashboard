import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { badge, relativeLong, statusBadge, statusLabel } from '../../../lib/format';
import { useLiveSupport } from '../../../hooks/useLiveSupport';
import { useSalesTeam } from '../../../hooks/useTeam';
import { listTickets, type SupportTicket } from '../../../services/support';
import { hasAdminReply } from './supportHelpers';

const H = 36e5;
const STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];

/** Admin › Support Tickets — GET /admin/support/tickets with status / priority / search filters. */
export function SupportTicketsTab() {
  const navigate = useNavigate();
  const f = useFormFields();
  const q = useQuery({ queryKey: ['support-tickets'], queryFn: ({ signal }) => listTickets(signal) });
  useLiveSupport();
  const { nameOf } = useSalesTeam();
  const all = q.data?.items ?? [];
  const stf = f.str('s.st', 'all');
  const pr = f.str('s.pr');
  const search = f.str('s.q').trim().toLowerCase();
  const list = all.filter((t) => (stf === 'all' || t.status === stf) && (!pr || t.priority === pr.toLowerCase()) && (!search || (t.subject + ' ' + t.userName + ' ' + t.referenceId).toLowerCase().includes(search)));
  const open = (t: SupportTicket) => () => navigate('/admin/settings/support/' + t.id);
  const assignee = (t: SupportTicket) => t.assignedToName || nameOf(t.assignedTo) || (t.assignedTo ? 'Assigned' : 'Unassigned');

  return (
    <RecordDetailView
      state={q.isPending ? 'loading' : q.isError ? 'error' : 'ok'}
      isPage
      onRetry={() => void q.refetch()}
      errorTitle="Could not load support tickets"
      title="Support Tickets"
      meta={all.filter((t) => t.status === 'open').length + ' open · ' + all.length + ' total'}
      single
      main={[
        {
          title: 'Filters',
          chips: STATUSES.map((k) => ({ label: (k === 'all' ? 'All' : statusLabel(k)) + ' (' + (k === 'all' ? all.length : all.filter((t) => t.status === k).length) + ')', on: stf === k, onClick: () => f.set('s.st', k) })),
          form: [f.inp('s.pr', 'Priority', { type: 'select', options: ['Urgent', 'High', 'Medium', 'Low'], placeholder: 'All priorities' }), f.inp('s.q', 'Search', { placeholder: 'Ticket, subject or user…' })],
        },
        {
          title: 'Tickets',
          rows: list.map((t) => {
            const age = (Date.now() - Date.parse(t.createdAt)) / H;
            const isOpen = ['open', 'in_progress'].includes(t.status);
            return {
              key: t.id,
              title: t.referenceId + ' · ' + t.subject,
              sub: t.userName + ' · ' + assignee(t) + ' · ' + relativeLong(t.createdAt),
              onClick: open(t),
              badges: [
                t.channel === 'live_chat' ? badge('Live Chat', 'teal') : null,
                statusBadge(t.priority),
                statusBadge(t.status),
                isOpen && t.priority === 'urgent' && age > 24 ? badge('Overdue', 'red') : null,
                isOpen && !hasAdminReply(t) && age > 48 ? badge('No response 48h+', 'orange') : null,
              ],
              actions: [btn('View', open(t))],
            };
          }),
          empty: list.length ? '' : all.length ? 'No tickets match filters' : 'No support tickets yet',
          actions: q.data?.truncated ? [btn('Showing first ' + all.length + ' of ' + q.data.total, undefined, 'link', { disabled: true })] : [],
        },
      ]}
    />
  );
}
