import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { dateTime, statusBadge, statusLabel } from '../../../lib/format';
import { listPushHistory, retryNotification, sendAdminPush, type SendPushBody } from '../../../services/notifications';
import { listUsers } from '../../../services/users';
import { toast } from '../../../store/uiStore';
import { downloadCsv } from '../../../lib/csv';

const NTYPES: Array<[string, string]> = [
  ['N-01', 'N-01 Enquiry Submitted (Buyer → P-08)'], ['N-02', 'N-02 Executive Call (Buyer P-08 / Seller P-05)'], ['N-03', 'N-03 Visit Scheduled (Buyer → B-12)'],
  ['N-04', 'N-04 Offer Sent (Seller → SL-12)'], ['N-05', 'N-05 Deal Confirmed (Buyer B-13 / Seller SL-14)'], ['N-06', 'N-06 Docs / Re-upload (Buyer B-14 / Seller SL-11)'],
  ['N-07', 'N-07 Payment (Buyer B-15 / Seller SL-15)'], ['N-08', 'N-08 Registration (Buyer B-16 / Seller SL-16)'], ['MANUAL', 'Manual'],
];
const FILTERS = ['all', 'sent', 'delivered', 'failed', 'dead_letter', 'queued'];

/** Tools › Push Notifications — POST /admin/notifications/push, history from GET /admin/notifications, retry via POST /admin/notifications/:id/retry. */
export function PushTab() {
  const f = useFormFields();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: ({ signal }) => listUsers(signal) });
  const histQ = useQuery({ queryKey: ['push-history'], queryFn: ({ signal }) => listPushHistory(signal) });
  const send = useRefreshingMutation((b: SendPushBody) => sendAdminPush(b), [['push-history']]);
  const retry = useRefreshingMutation((id: string) => retryNotification(id), [['push-history']]);
  const aud = f.str('p.aud', 'Buyer');
  const filt = f.str('p.f', 'all');
  const users = (usersQ.data?.items ?? []).filter((u) => (aud === 'Buyer' ? u.role !== 'seller' : u.role !== 'buyer') && !u.isBlocked);
  const all = histQ.data ?? [];
  const log = all.filter((p) => filt === 'all' || p.status === filt);
  const userName = (id: string, fallback: string) => fallback || (usersQ.data?.items ?? []).find((u) => u.id === id)?.name || 'User';
  const failed = all.filter((p) => ['failed', 'dead_letter'].includes(p.status)).length;

  const submit = () => {
    if (!f.need({ 'p.user': 'Select a user', 'p.title': 'Title is required', 'p.msg': 'Message is required' })) return;
    const user = users.find((u) => u.id === f.str('p.user'));
    const ref = f.str('p.ref').trim();
    send.mutate(
      {
        userId: f.str('p.user'),
        audience: aud === 'Seller' ? 'seller' : 'buyer',
        notificationType: f.str('p.type', 'MANUAL'),
        title: f.str('p.title').trim(),
        message: f.str('p.msg').trim(),
        ...(ref ? { entityId: ref } : {}),
      },
      { onSuccess: () => { f.clear('p.'); toast('🔔 Notification queued for ' + (user?.name || 'user')); } },
    );
  };

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Push Notifications"
      meta="Send manual notifications, review delivery history, and retry failed pushes."
      single
      hActions={[btn('Refresh', () => void histQ.refetch().then(() => toast('Refreshed')), 'outline', { loading: histQ.isFetching })]}
      main={[
        {
          title: 'Send Notification',
          form: [
            f.inp('p.aud', 'Audience', { type: 'select', options: ['Buyer', 'Seller'], default: 'Buyer' }),
            f.inp('p.user', 'User', { type: 'select', options: users.map((u) => ({ value: u.id, label: u.name + ' · ' + (u.phone || u.referenceId) })), placeholder: usersQ.isPending ? 'Loading users…' : 'Select user', required: true }),
            f.inp('p.type', 'Notification Type', { type: 'select', options: NTYPES.map(([value, label]) => ({ value, label })), default: 'MANUAL' }),
            f.inp('p.title', 'Title', { placeholder: 'Notification title', required: true }),
            f.inp('p.msg', 'Message', { type: 'textarea', placeholder: 'Notification message', required: true }),
            f.inp('p.ref', 'Related ID (Listing / Enquiry / Deal / Property)', { placeholder: 'e.g. ENQ-2401' }),
          ],
          banners: [f.str('p.title') ? { text: '🔔 BuiltGlory · ' + f.str('p.title') + ' — ' + f.str('p.msg'), tone: 'muted' } : null],
          actions: [btn('Send Notification', submit, 'primary', { loading: send.isPending })],
        },
        {
          title: 'Notification History',
          chips: FILTERS.map((k) => ({ label: k === 'all' ? 'All statuses' : statusLabel(k) + ' (' + all.filter((p) => p.status === k).length + ')', on: filt === k, onClick: () => f.set('p.f', k) })),
          rows: log.map((p) => ({
            key: p.id,
            title: p.title,
            sub: p.notificationType + (p.audience ? ' · ' + statusLabel(p.audience) : '') + ' · ' + userName(p.userId, p.userName) + ' · ' + dateTime(p.createdAt) + (p.opened ? ' · Opened' : '') + (p.failureReason ? '\n' + p.failureReason : ''),
            badges: [statusBadge(p.status)],
            actions: ['failed', 'dead_letter'].includes(p.status) ? [{ label: 'Retry', onClick: () => retry.mutate(p.id, { onSuccess: () => toast('🔁 Retry queued') }) }] : [],
          })),
          empty: log.length ? '' : histQ.isPending ? 'Loading…' : histQ.isError ? 'Could not load notification history' : 'No push notifications yet.',
        },
        {
          title: 'Delivery Reports',
          cols: 3,
          fields: [
            { label: 'Sent', value: all.length, strong: true },
            { label: 'Delivered', value: all.filter((p) => p.status === 'delivered').length, color: '#15803d', strong: true },
            { label: 'Opened', value: all.filter((p) => p.opened).length, strong: true },
            { label: 'Failed', value: failed, color: '#dc2626', strong: true },
          ],
          actions: [
            btn('Export Reports', () => {
              if (!all.length) return toast('No notifications to export');
              downloadCsv('push-delivery-report.csv', ['Title', 'Message', 'Type', 'Audience', 'User', 'Status', 'Opened', 'Sent at', 'Failure'], all.map((p) => [p.title, p.message, p.notificationType, p.audience, userName(p.userId, p.userName), p.status, p.opened ? 'Yes' : 'No', dateTime(p.createdAt), p.failureReason]));
              toast('📥 Exporting delivery report');
            }),
          ],
        },
      ]}
    />
  );
}
