import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, contactActions, crumbsFor, personSection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { BUDGET_LABEL, STYLE_LABEL } from '../../../constants/enquiries';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useDesigners } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { reachOut } from '../../../lib/contact';
import { badge, price, relativeLong, shortId, statusLabel } from '../../../lib/format';
import { getInteriorLead, updateInteriorLead, type UpdateInteriorLeadBody } from '../../../services/enquiries';
import { createSalesDeal } from '../../../services/sales';
import { askConfirm, toast } from '../../../store/uiStore';

const H = 36e5;

export function InteriorLeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['interior-lead', id], queryFn: ({ signal }) => getInteriorLead(id, signal), retry: false });
  const l = q.data;
  const { designers, nameOf } = useDesigners();
  const wf = useWorkflowSections('interior_lead', id, f, l?.createdAt);
  const lock = useEditLock('interior_lead', id);
  const keys = [['interior-lead', id], ['interior-leads']];
  const update = useRefreshingMutation((body: UpdateInteriorLeadBody) => updateInteriorLead(id, body), keys);
  const toDeal = useRefreshingMutation(() => createSalesDeal({ buyerId: l!.buyerId, propertyId: l!.propertyId }), [['sales-deals']]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !l) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/enquiries/interior" />;

  const deadline = l.slaDeadline ? Date.parse(l.slaDeadline) : Date.parse(l.createdAt) + 24 * H;
  const remaining = deadline - Date.now();
  const breached = l.status === 'new' && remaining <= 0;
  const designer = nameOf(l.assignedDesigner, l.designerName) || l.designerName;
  const quote = l.quote;
  const quoteSentAt = l.status === 'quote_sent' ? Date.parse(l.updatedAt) : NaN;
  const validUntil = quote?.validUntil ? Date.parse(quote.validUntil) : quoteSentAt + 72 * H;
  const quoteExpired = l.status === 'quote_sent' && !isNaN(validUntil) && Date.now() > validUntil;
  const setSt = (s: string, msg: string) => update.mutate({ status: s }, { onSuccess: () => toast(msg) });
  const outcome = (s: string, msg: string, extra: UpdateInteriorLeadBody = {}) => update.mutate({ status: s, ...extra }, { onSuccess: () => toast(msg) });
  const available = designers.filter((d) => d.isAvailable);

  const acceptQ = () => {
    const d = designers.find((x) => x.id === l.assignedDesigner);
    if (!d) {
      return modal.open({
        title: '❌ No Designer Assigned',
        fields: [{ key: 'd', label: 'Select available designer', type: 'select', options: available.map((x) => ({ value: x.id, label: x.name })), required: true }],
        submit: 'Assign & Accept',
        onSubmit: async (v) => {
          await update.mutateAsync({ assignedDesigner: String(v.d), status: 'accepted', customerAcceptedAt: new Date().toISOString() });
          toast('✅ Quote accepted');
        },
      });
    }
    if (!d.isAvailable) {
      return modal.open({
        title: '⚠️ Designer Unavailable',
        subtitle: d.name + ' is unavailable',
        fields: [{ key: 'd', label: 'Assign a different designer', type: 'select', options: available.map((x) => ({ value: x.id, label: x.name })) }],
        submit: 'Reassign & Accept',
        onSubmit: async (v) => {
          await update.mutateAsync({ ...(v.d ? { assignedDesigner: String(v.d) } : {}), status: 'accepted', customerAcceptedAt: new Date().toISOString() });
          toast('✅ Quote accepted');
        },
        extraActions: [
          { label: 'Accept Anyway', onClick: () => outcome('accepted', '✅ Quote accepted', { customerAcceptedAt: new Date().toISOString() }) },
          { label: 'Put on Hold', onClick: () => setSt('negotiating', 'Hold acceptance until designer is available') },
        ],
      });
    }
    outcome('accepted', '✅ Buyer accepted the quote', { customerAcceptedAt: new Date().toISOString() });
  };

  const sendQuote = () => {
    if (!f.need({ 'q.pkg': 'Package name is required', 'q.price': 'Total price is required' })) return;
    const amount = Number(f.str('q.price'));
    if (!(amount > 0)) return void f.fail('q.price', 'Enter a valid price');
    const go = () =>
      update.mutate(
        {
          status: 'quote_sent',
          ...(f.str('q.designer') ? { assignedDesigner: f.str('q.designer') } : {}),
          quote: {
            amount,
            packageName: f.str('q.pkg'),
            timeline: f.str('q.time') || '6 weeks',
            inclusions: f.str('q.inc').split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
            validUntil: new Date(Date.now() + 72 * H).toISOString(),
          },
        },
        { onSuccess: () => { f.clear('q.'); toast('📤 Quote sent — buyer notified'); } },
      );
    if (!f.str('q.designer') && !l.assignedDesigner) askConfirm({ title: '⚠️ No designer assigned', message: 'Assign a designer before sending, or send anyway.', confirmLabel: 'Send Anyway', onConfirm: go });
    else go();
  };

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/enquiries/interior"
      crumbs={crumbsFor('Enquiries', '/admin/enquiries/buy', 'Interior Leads', '/admin/enquiries/interior', l.buyerName)}
      title={l.buyerName}
      badges={[statusBadge(l.status), breached ? { text: 'SLA breached', tone: 'red' } : null]}
      meta={shortId(l.id, l.referenceId) + ' • ' + l.propertyTitle + ' • Requested ' + relativeLong(l.createdAt)}
      hActions={contactActions({ name: l.buyerName, phone: l.phone, email: l.email, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } })}
      banners={[
        lock,
        breached ? { text: '🔴 SLA breached — respond immediately', tone: 'error', actions: [{ label: '💬 WhatsApp', onClick: () => { reachOut('whatsapp', { name: l.buyerName, to: l.phone, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }); setSt('contacted', 'Marked as contacted'); } }, { label: '📧 Email', onClick: () => { reachOut('email', { name: l.buyerName, to: l.email, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }); if (l.email) setSt('contacted', 'Marked as contacted'); } }] } : null,
        quoteExpired ? { text: '⚠️ Quote validity (72hrs) has expired.', tone: 'warn', actions: [{ label: 'Send New Quote', onClick: () => f.set('q.pkg', quote?.packageName || '') }] } : null,
        l.status === 'quote_sent' && !quoteExpired && Date.now() - quoteSentAt > 48 * H ? { text: 'No response in 48hrs. Consider following up.', tone: 'warn' } : null,
      ]}
      main={[
        {
          title: 'Requirements from App',
          tag: 'App screen: INT-04',
          fields: [
            { label: 'Selected Rooms', value: l.rooms.join(', ') },
            { label: 'Design Style', value: STYLE_LABEL[l.style] || statusLabel(l.style) },
            { label: 'Budget Range', value: BUDGET_LABEL[l.budget] || statusLabel(l.budget) },
          ],
          text: l.specialNotes || 'No special notes',
          actions: l.propertyId ? [btn('View Property', () => navigate('/admin/properties/' + l.propertyId), 'link')] : [],
        },
        {
          title: 'Send Quote to Buyer',
          tag: 'App screen: INT-05',
          form: [
            f.inp('q.pkg', 'Package name', { required: true, placeholder: 'Premium Interior Package' }),
            f.inp('q.price', 'Total price (₹)', { type: 'number', required: true }),
            f.inp('q.time', 'Timeline', { placeholder: '6 weeks' }),
            f.inp('q.designer', 'Designer assigned', { type: 'select', options: designers.map((d) => ({ value: d.id, label: d.name })), placeholder: '— Select designer —', default: l.assignedDesigner || '' }),
            f.inp('q.inc', 'Inclusions', { type: 'textarea', placeholder: 'Modular kitchen, wardrobes, false ceiling…' }),
          ],
          banners: [{ text: 'Quote validity: 72 hours · 📱 Buyer will receive: "Your interior quote is ready"', tone: 'muted' }],
          actions: [btn(quote ? 'Send Revised Quote' : 'Send Quote & Notify Buyer', sendQuote, 'primary', { loading: update.isPending })],
        },
        {
          title: 'Quote History',
          rows: quote
            ? [
                {
                  title: (quote.packageName || 'Interior quote') + ' · ' + price(quote.amount),
                  sub: (quote.timeline || '—') + (l.status === 'quote_sent' ? ' · sent ' + relativeLong(l.updatedAt) : '') + (quote.inclusions.length ? '\n' + quote.inclusions.join(', ') : ''),
                  badges: [l.status === 'quote_sent' ? (quoteExpired ? badge('Expired', 'muted') : badge('⏳ Awaiting buyer response...', 'amber')) : badge(statusLabel(l.status), l.status === 'accepted' ? 'green' : l.status === 'declined' ? 'red' : 'orange')],
                  actions:
                    l.status === 'quote_sent' && !quoteExpired
                      ? [
                          { label: '✅ Buyer Accepted', variant: 'green', onClick: acceptQ },
                          { label: '💬 Buyer Negotiating', onClick: () => outcome('negotiating', 'Marked as negotiating') },
                          { label: '❌ Buyer Declined', variant: 'red', onClick: () => outcome('declined', 'Quote declined') },
                        ]
                      : [],
                },
              ]
            : [],
          empty: quote ? '' : 'No quotes sent yet',
          actions: [
            btn('Move to Sales Pipeline', () =>
              toDeal.mutate(undefined, {
                onSuccess: (d) => {
                  toast('➡️ Deal created in Active Leads');
                  navigate('/admin/sales/' + d.id);
                },
              }), 'link', { disabled: !l.buyerId || !l.propertyId }),
          ],
        },
        wf.notes(),
      ]}
      side={[
        personSection('Buyer Info', { name: l.buyerName, phone: l.phone, email: l.email }, [{ label: 'User type', value: l.userType ? l.userType.toUpperCase() : '' }], l.buyerId ? '/admin/users/' + l.buyerId : null, 'View Buyer Profile', navigate),
        {
          title: 'Response SLA (24hrs)',
          subtitle: 'All interior leads must be responded to within 24 hours',
          cols: 1,
          fields: [
            { label: l.status === 'new' ? (breached ? 'Overdue by' : 'Time remaining') : 'Status', value: l.status === 'new' ? Math.abs(Math.round(remaining / H)) + ' hrs' : 'Responded', color: breached ? '#dc2626' : '#15803d', strong: true },
            { label: 'Designer', value: designer || '⚠️ No designer assigned' },
          ],
          chips: designers.map((d) => ({
            label: d.name + ' · ' + (d.isAvailable ? 'Available' : 'Busy'),
            on: d.id === l.assignedDesigner,
            onClick: () => update.mutate({ assignedDesigner: d.id }, { onSuccess: () => toast('🎨 ' + d.name + ' assigned') }),
          })),
        },
        {
          title: 'Quick Actions',
          stack: true,
          actions: [
            btn('📤 Send Quote', () => f.set('q.pkg', f.str('q.pkg') || 'Premium Interior Package')),
            btn('💬 WhatsApp', () => { reachOut('whatsapp', { name: l.buyerName, to: l.phone, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }); if (l.status === 'new') setSt('contacted', 'Marked as contacted'); }),
            btn('📧 Email', () => { reachOut('email', { name: l.buyerName, to: l.email, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }); if (l.status === 'new' && l.email) setSt('contacted', 'Marked as contacted'); }),
            l.status !== 'declined' ? btn('❌ Mark Declined', () => askConfirm({ title: 'Mark as declined?', confirmLabel: 'Mark Declined', tone: 'destructive', onConfirm: async () => { await update.mutateAsync({ status: 'declined' }); toast('Lead marked declined'); } }), 'red') : null,
          ],
        },
        wf.activity('Activity Timeline'),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
