import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { badge, dateTime, fillVars, num, statusLabel, todayIso } from '../../../lib/format';
import { listBulkMessages, listTemplates, sendBulkMessage, type BulkPayload } from '../../../services/messaging';
import { listUsers } from '../../../services/users';
import { askConfirm, toast } from '../../../store/uiStore';
import type { AdminUser } from '../../../types/users';

const CHANNELS: Record<string, BulkPayload['channel']> = { WhatsApp: 'whatsapp', Email: 'email', SMS: 'sms' };

/** Tools › Bulk Message — recipients from GET /admin/users, send via POST /admin/bulk-messages, history from GET /admin/bulk-messages. */
export function BulkMessageTab() {
  const f = useFormFields();
  const modal = useFormModal();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: ({ signal }) => listUsers(signal) });
  const tplQ = useQuery({ queryKey: ['message-templates'], queryFn: ({ signal }) => listTemplates(signal) });
  const histQ = useQuery({ queryKey: ['bulk-messages'], queryFn: ({ signal }) => listBulkMessages(signal) });
  const send = useRefreshingMutation((b: BulkPayload) => sendBulkMessage(b), [['bulk-messages']]);

  const U = (usersQ.data?.items ?? []).filter((u) => !u.isBlocked);
  const city = f.str('cf.city');
  const after = f.str('cf.after');
  const groups: Record<string, [string, AdminUser[]]> = {
    all: ['All Users', U],
    buyers: ['All Buyers', U.filter((u) => u.role !== 'seller')],
    sellers: ['All Sellers', U.filter((u) => u.role !== 'buyer')],
    nri: ['NRI Users', U.filter((u) => u.userType !== 'resident')],
    custom: ['Custom Filter', U.filter((u) => (!city || u.city.toLowerCase() === city.toLowerCase()) && (!after || u.registeredAt.slice(0, 10) >= after))],
  };
  const g = f.str('grp', 'all');
  const recipients = groups[g]![1];
  const n = recipients.length;
  const ch = f.str('b.ch', 'WhatsApp');
  const templates = tplQ.data ?? [];
  const tpl = templates.find((t) => t.id === f.str('b.tpl'));
  const cities = [...new Set(U.map((u) => u.city).filter(Boolean))].sort();
  const hist = histQ.data ?? [];

  const doSend = (when?: string) => {
    if (!f.need({ 'b.body': 'Message body is required' })) return;
    if (!n) return toast('No users match the selected recipients');
    if (ch === 'WhatsApp' && n > 1000) return toast('WhatsApp Business API limit: 1,000 messages/day');
    const body: BulkPayload = {
      audience: g,
      channel: CHANNELS[ch] ?? 'whatsapp',
      title: ch === 'Email' ? f.str('b.title').trim() || undefined : undefined,
      message: f.str('b.body').trim(),
      ...(g === 'custom' ? { recipients: recipients.map((u) => u.id) } : {}),
      ...(tpl ? { templateId: tpl.id } : {}),
      ...(when ? { scheduledAt: when } : {}),
    };
    const go = () =>
      send.mutateAsync(body).then((r) => {
        f.clear('b.');
        toast(when ? '🗓 Scheduled for ' + dateTime(when) : '📤 Queued for ' + (r.recipients || n) + ' users');
      });
    if (when) return void go().catch(() => undefined);
    askConfirm({
      title: 'Confirm bulk send',
      message: 'Message will be sent to ' + n + ' users via ' + ch + '.',
      input: { label: 'Type CONFIRM to proceed:', required: true },
      confirmLabel: 'Send Now',
      tone: 'destructive',
      onConfirm: ({ value }) => {
        if (value.trim() !== 'CONFIRM') throw new Error('Type CONFIRM exactly to send');
        return go();
      },
    });
  };

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Bulk Message"
      meta="Send one message to a group of users"
      single
      main={[
        {
          title: 'Select Recipients',
          chips: Object.keys(groups).map((k) => ({ label: groups[k]![0] + (k === 'custom' ? '' : ' (' + groups[k]![1].length + ' users)'), on: g === k, onClick: () => f.set('grp', k) })),
          form: g === 'custom' ? [f.inp('cf.city', 'City', { type: 'select', options: cities, placeholder: 'Any city' }), f.inp('cf.after', 'Registered after', { type: 'date' })] : [],
          banners: [
            usersQ.isPending ? { text: 'Loading users…', tone: 'muted' } : usersQ.isError ? { text: 'Could not load users', tone: 'error' } : { text: 'Message will be sent to ' + n + ' users', tone: 'info' },
            ch === 'WhatsApp' ? { text: 'WhatsApp Business API limit: 1,000 messages/day', tone: 'muted' } : null,
          ],
        },
        {
          title: 'Compose Message',
          form: [
            f.inp('b.ch', 'Channel', { type: 'select', options: ['WhatsApp', 'Email', 'SMS'], default: 'WhatsApp' }),
            f.inp('b.tpl', 'Use Template', { type: 'select', options: templates.map((t) => ({ value: t.id, label: t.name })), placeholder: 'Select template' }),
            ch === 'Email' ? f.inp('b.title', 'Message title (email)') : null,
            f.inp('b.body', 'Message body', { type: 'textarea', required: true }),
          ],
          text: f.str('b.body') ? 'Preview: ' + fillVars(f.str('b.body'), { name: recipients[0]?.name.split(' ')[0] || 'there', property: 'your property' }) : '',
          actions: [
            tpl ? btn('Insert template', () => f.set('b.body', tpl.body)) : null,
            btn('Send Now', () => doSend(), 'primary', { loading: send.isPending }),
            btn('Schedule for Later', () =>
              modal.open({
                title: 'Schedule for Later',
                fields: [{ key: 'd', label: 'Send on', type: 'date', min: todayIso(), required: true }],
                onSubmit: (v) => doSend(new Date(String(v.d) + 'T10:00:00').toISOString()),
              })),
          ],
        },
        {
          title: 'Bulk Send History',
          rows: hist.map((h) => ({
            key: h.id,
            title: statusLabel(h.channel) + ' · ' + num(h.recipients) + ' recipients',
            sub: (h.scheduledAt && h.status === 'scheduled' ? 'Scheduled ' + dateTime(h.scheduledAt) : dateTime(h.date)) + ' · ' + h.sentBy + (h.message ? '\n' + h.message.slice(0, 80) : ''),
            badges: [badge(statusLabel(h.status), ['sent', 'completed', 'delivered'].includes(h.status) ? 'green' : h.status === 'failed' ? 'red' : 'amber')],
          })),
          empty: hist.length ? '' : histQ.isPending ? 'Loading…' : histQ.isError ? 'Could not load bulk send history' : 'No bulk messages sent yet',
        },
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
