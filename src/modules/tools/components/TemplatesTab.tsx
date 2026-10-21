import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useDebounced } from '../../../hooks/useDomUtils';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { dateTime } from '../../../lib/format';
import { createTemplate, deleteTemplate, listMessageHistory, listTemplates, updateTemplate, type TemplatePayload } from '../../../services/messaging';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import { ENTITY_LABEL, ENTITY_ROUTE } from '../../../constants/entityRoutes';

const VARS = ['{name}', '{property}', '{price}', '{date}', '{time}', '{amount}'];
const CHANNEL = (c: string) => (c === 'email' || c === 'sms' ? c : 'whatsapp') as TemplatePayload['channel'];

/** Tools › Message Templates — /admin/message-templates CRUD and outgoing history from /admin/communication-logs. */
export function TemplatesTab() {
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const tq = useQuery({ queryKey: ['message-templates'], queryFn: ({ signal }) => listTemplates(signal) });
  const search = useDebounced(f.str('mq'), 300);
  const hq = useQuery({ queryKey: ['message-history', search], queryFn: ({ signal }) => listMessageHistory(search, signal) });
  const mut = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['message-templates']]);
  const templates = tq.data ?? [];
  const hist = hq.data ?? [];
  const body = f.str('t.body');

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Message Templates"
      meta="These templates are used across the dashboard for WhatsApp, Email and SMS communications."
      single
      main={[
        {
          title: 'Templates',
          rows: templates.map((t) => ({
            key: t.id,
            title: t.name,
            sub: t.category + ' · ' + t.channel.toUpperCase() + '\n' + t.body,
            actions: [
              {
                label: 'Edit',
                onClick: () =>
                  modal.open({
                    title: 'Edit template',
                    fields: [
                      { key: 'n', label: 'Template name', required: true, default: t.name },
                      ...(t.channel === 'email' ? [{ key: 's', label: 'Email subject', default: t.subject }] : []),
                      { key: 'b', label: 'Template body', type: 'textarea', required: true, default: t.body },
                    ],
                    onSubmit: (v) => mut.mutateAsync(() => updateTemplate(t.id, { name: String(v.n).trim(), body: String(v.b), ...(t.channel === 'email' ? { subject: String(v.s || '') } : {}) })).then(() => toast('✅ Template updated')),
                  }),
              },
              { label: 'Duplicate', onClick: () => mut.mutate(() => createTemplate({ name: t.name + ' (copy)', channel: CHANNEL(t.channel), category: t.category, subject: t.subject || undefined, body: t.body }), { onSuccess: () => toast('Template duplicated') }) },
              { label: 'Compose', onClick: () => openCompose({ channel: CHANNEL(t.channel), askTo: true, subject: t.subject || undefined, body: t.body, title: 'Compose · ' + t.name }) },
              { label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete template?', message: 'This removes it from the template list and bulk message picker.', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => mut.mutateAsync(() => deleteTemplate(t.id)).then(() => toast('Template deleted')) }) },
            ],
          })),
          empty: templates.length ? '' : tq.isPending ? 'Loading…' : tq.isError ? 'Could not load templates' : 'No templates yet',
          actions: tq.isError ? [btn('Retry', () => void tq.refetch())] : [],
        },
        {
          title: 'Add Template',
          form: [
            f.inp('t.name', 'Template name', { required: true }),
            f.inp('t.cat', 'Category', { type: 'select', options: ['Enquiry', 'Visit', 'Payment', 'Documents', 'Marketing'], default: 'Enquiry' }),
            f.inp('t.ch', 'Channel', { type: 'select', options: ['whatsapp', 'email', 'sms'], default: 'whatsapp' }),
            f.str('t.ch') === 'email' ? f.inp('t.sub', 'Email subject') : null,
            f.inp('t.body', 'Template body', { type: 'textarea', required: true }),
          ],
          subtitle: 'Click to insert:',
          chips: VARS.map((v) => ({ label: v, on: body.includes(v), onClick: () => f.set('t.body', body + v) })),
          banners: [VARS.some((v) => body.includes(v)) ? null : { text: 'No variables used', tone: 'muted' }],
          actions: [
            btn('Save Template', () => {
              if (!f.need({ 't.name': 'Template name is required', 't.body': 'Template body is required' })) return;
              mut.mutate(
                () => createTemplate({ name: f.str('t.name').trim(), category: f.str('t.cat', 'Enquiry'), channel: CHANNEL(f.str('t.ch', 'whatsapp')), subject: f.str('t.sub') || undefined, body: f.str('t.body') }),
                { onSuccess: () => { f.clear('t.'); toast('✅ Template saved'); } },
              );
            }, 'primary', { loading: mut.isPending }),
          ],
        },
        {
          title: 'Message History',
          subtitle: 'All Outgoing Messages',
          formCols: 1,
          form: [f.inp('mq', '', { placeholder: 'Search by name or message…' })],
          rows: hist.slice(0, 40).map((m) => {
            const route = ENTITY_ROUTE[m.entityType];
            return {
              key: m.id,
              title: (m.channel === 'email' ? '📧 ' : m.channel === 'message' ? '✉️ ' : '💬 ') + m.summary,
              sub: (m.body ? m.body + '\n' : '') + (m.entityType ? 'Related: ' + (ENTITY_LABEL[m.entityType] || m.entityType) + ' · ' : '') + 'Sent by ' + m.actorName + ' · ' + dateTime(m.occurredAt),
              actions: route && m.entityId ? [{ label: 'Open', onClick: () => navigate(route + m.entityId) }] : [],
            };
          }),
          empty: hist.length ? '' : hq.isPending ? 'Loading…' : hq.isError ? 'Could not load message history' : 'No messages logged yet. Sends from user, enquiry, visit, and other detail pages appear here.',
        },
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
