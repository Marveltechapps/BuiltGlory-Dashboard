import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, crumbsFor, personSection, propertySection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { INTEREST_LONG, SLOTS } from '../../../constants/enquiries';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useProperty } from '../../../hooks/useProperty';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { callPhone } from '../../../lib/contact';
import { date, isHttpsUrl, price, relativeLong, shortId, statusLabel, todayIso } from '../../../lib/format';
import { convertEnquiryToDeal, createAdminVisit, getBuyEnquiry, updateBuyEnquiry } from '../../../services/enquiries';
import { createLog } from '../../../services/workflow';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import { visitPrefLabel } from '../components/enquiryHelpers';

const BUY_NEXT: Record<string, string[]> = {
  new: ['responded', 'visit_scheduled', 'closed'],
  responded: ['visit_scheduled', 'negotiating', 'closed'],
  visit_scheduled: ['negotiating', 'closed'],
  negotiating: ['closed'],
  closed: [],
};

export function BuyEnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['buy-enquiry', id], queryFn: ({ signal }) => getBuyEnquiry(id, signal), retry: false });
  const e = q.data;
  const prop = useProperty(e?.propertyId);
  const { team, nameOf } = useSalesTeam();
  const wf = useWorkflowSections('buy_enquiry', id, f, e?.createdAt);
  const lock = useEditLock('buy_enquiry', id);
  const keys = [['buy-enquiry', id], ['buy-enquiries']];
  const update = useRefreshingMutation((body: Parameters<typeof updateBuyEnquiry>[1]) => updateBuyEnquiry(id, body), keys);
  const convert = useRefreshingMutation(() => convertEnquiryToDeal(id), [...keys, ['sales-deals']]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !e) {
    return <RecordDetailView state={state} nfTitle="Record not found" onRetry={() => void q.refetch()} backPath="/admin/enquiries/buy" />;
  }

  const p = prop.data;
  const first = e.buyerName.split(' ')[0];
  const assigned = nameOf(e.assignedTo, e.assignedName) || e.assignedName;
  const entity = { type: 'buy_enquiry' as const, id: e.id };
  const setStatus = (s: string, msg?: string) => update.mutate({ status: s }, { onSuccess: () => toast(msg || '✅ Status updated') });

  const schedule = () => {
    if (e.status === 'closed') return toast('Closed enquiries stay closed.');
    modal.open({
      title: 'Schedule Visit',
      subtitle: e.buyerName + ' · ' + e.propertyTitle,
      formCols: 2,
      fields: [
        { key: 'date', label: 'Visit date', type: 'date', required: true, min: todayIso() },
        { key: 'time', label: 'Visit time', type: 'select', options: SLOTS, required: true, default: '10:00 AM' },
        { key: 'type', label: 'Visit type', type: 'select', options: ['Physical', 'Virtual'], default: 'Physical' },
        { key: 'who', label: 'Assigned admin', type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), default: e.assignedTo || '' },
        { key: 'link', label: 'Meeting link', placeholder: 'Add meeting link for virtual visit', full: true },
      ],
      validate: (v) => ({ date: String(v.date) < todayIso() ? 'Date is in the past' : '', link: isHttpsUrl(String(v.link || '')) ? '' : 'URL must start with https://' }),
      submit: 'Confirm Visit',
      onSubmit: async (v) => {
        if (e.status === 'closed') return toast('Closed enquiries stay closed.');
        if (!e.buyerId || !e.propertyId) return toast('This enquiry needs a buyer and a property before a visit can be created.');
        const visitType = String(v.type).toLowerCase() === 'virtual' ? 'virtual' : 'physical';
        await createAdminVisit({
          buyerId: e.buyerId,
          propertyId: e.propertyId,
          enquiryId: e.id,
          visitDate: String(v.date),
          visitTime: String(v.time),
          visitType,
          ...(v.link ? { meetingLink: String(v.link) } : {}),
          ...(v.who ? { assignedAdmin: String(v.who) } : {}),
        });
        const when = date(v.date + 'T12:00:00') + ', ' + v.time;
        const statusPatch = e.status === 'new' || e.status === 'responded' ? { status: 'visit_scheduled' as const } : {};
        if (statusPatch.status || v.who) await updateBuyEnquiry(id, { ...statusPatch, ...(v.who ? { assignedTo: String(v.who) } : {}) });
        await createLog('buy_enquiry', id, { channel: 'note', direction: 'internal', summary: 'Visit created for ' + when + ' (' + v.type + ')', body: v.link ? 'Meeting link: ' + v.link : null });
        void q.refetch();
        void wf.logsQ.refetch();
        toast('📅 Visit scheduled for ' + date(v.date + 'T12:00:00'));
      },
    });
  };

  const negotiate = () => {
    if (e.status === 'closed') return toast('Closed enquiries stay closed.');
    if (e.status === 'negotiating') {
      toast('Negotiation is already open');
      return navigate('/admin/enquiries/chat');
    }
    void (async () => {
      if (e.status === 'new') await update.mutateAsync({ status: 'responded' });
      await update.mutateAsync({ status: 'negotiating' });
      toast('💬 Negotiation thread opened');
      navigate('/admin/enquiries/chat');
    })();
  };
  const toSales = () => {
    if (e.dealId) return navigate('/admin/sales/' + e.dealId);
    convert.mutate(undefined, {
      onSuccess: (d) => {
        toast('➡️ Deal created in Active Leads');
        if (d.id) navigate('/admin/sales/' + d.id);
      },
    });
  };
  const statusOptions = [e.status, ...(BUY_NEXT[e.status] || [])].filter((s, i, list) => list.indexOf(s) === i);
  const sendDetails = () =>
    openCompose({ channel: 'whatsapp', name: e.buyerName, to: e.phone, entity, body: 'Hi ' + first + ', here are the details for ' + e.propertyTitle + ' — ' + price(p?.price || e.propertyPrice) + ', ' + (p?.locality || e.propertyLocation || '') + '. Reply to book a visit. — BuiltGlory' });
  const cta =
    e.interest === 'schedule_visit' ? btn('📅 Create Visit', schedule, 'primary') : e.interest === 'price_negotiation' ? btn('💬 Start Negotiation', negotiate, 'primary') : btn('📤 Send Details', sendDetails, 'primary');
  const oldNew = e.status === 'new' && Date.now() - Date.parse(e.createdAt) > 2 * 864e5;

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/enquiries/buy"
      crumbs={crumbsFor('Enquiries', '/admin/enquiries/buy', 'Buy Enquiries', '/admin/enquiries/buy', e.buyerName)}
      title={e.buyerName}
      badges={[statusBadge(e.status), e.userType !== 'resident' ? { text: e.userType.toUpperCase(), tone: 'indigo' } : null]}
      meta={shortId(e.id, e.referenceId) + ' • Submitted ' + relativeLong(e.createdAt) + ' • Source: ' + statusLabel(e.source || 'app')}
      hActions={[
        btn('📞 Call Now', () => callPhone(e.buyerName, e.phone)),
        btn('💬 Contact via WhatsApp', () => openCompose({ channel: 'whatsapp', name: e.buyerName, to: e.phone, property: e.propertyTitle, entity }), 'green'),
        btn('📧 Send Email', () => openCompose({ channel: 'email', name: e.buyerName, to: e.email, property: e.propertyTitle, entity }), 'outline', { disabled: !e.email }),
      ]}
      banners={[
        lock,
        p?.status === 'sold'
          ? { text: '⚠️ This property has been sold', tone: 'error', actions: [{ label: 'Notify Buyer', onClick: () => openCompose({ channel: 'whatsapp', name: e.buyerName, to: e.phone, entity, body: 'Hi ' + first + ', ' + e.propertyTitle + ' has been sold. Can we share similar options?' }) }] }
          : null,
        p && (p.isDeleted || !p.isVisibleOnApp) && p.status !== 'sold' ? { text: '⚠️ Property no longer available', tone: 'warn', actions: [{ label: 'Show similar properties', onClick: () => navigate('/admin/properties/all') }] } : null,
        e.duplicateOf ? { text: 'Duplicate enquiry', tone: 'warn', actions: [{ label: 'View original →', onClick: () => navigate('/admin/enquiries/buy/' + e.duplicateOf) }] } : null,
        oldNew ? { text: 'Preferred time has passed — ask buyer for new availability.', tone: 'warn' } : null,
        e.dealId ? { text: '➡️ This enquiry is in the Sales Pipeline', tone: 'info', actions: [{ label: 'View deal →', onClick: () => navigate('/admin/sales/' + e.dealId) }] } : null,
      ]}
      main={[
        {
          ...propertySection('Property Interested In', p, { id: e.propertyId, title: e.propertyTitle, price: e.propertyPrice, type: e.propertyType, location: e.propertyLocation }, navigate),
          actions: e.propertyId ? [btn('View Property Page →', () => navigate('/admin/properties/' + e.propertyId), 'link')] : [],
        },
        {
          title: 'Enquiry Details',
          tag: 'App screen: B-10',
          fields: [
            { label: 'Preferred Contact', value: statusLabel(e.preferredContact) },
            { label: 'Interested In', value: INTEREST_LONG[e.interest] || statusLabel(e.interest) },
            { label: 'Preferred Visit Time', value: visitPrefLabel(e) },
            { label: 'Source', value: statusLabel(e.source || 'app') },
          ],
          text: e.message ? '“' + e.message + '”' : 'No additional message',
          actions: [
            cta,
            e.interest === 'schedule_visit' ? null : btn('📅 Schedule Visit', schedule),
            e.preferredContact !== 'email' && e.email ? btn('Offer Email instead', () => openCompose({ channel: 'email', name: e.buyerName, to: e.email, property: e.propertyTitle, entity }), 'link') : null,
          ],
        },
        wf.notes(),
      ]}
      side={[
        {
          title: 'Status',
          formCols: 1,
          form: [f.inp('status', 'Enquiry status', { type: 'select', options: statusOptions.map((s) => ({ value: s, label: statusLabel(s) })), default: e.status })],
          actions: [btn('Update Status', () => { const s = f.str('status', e.status); if (s !== e.status) setStatus(s); }, 'primary', { loading: update.isPending })],
        },
        {
          title: 'Assign To',
          cols: 1,
          formCols: 1,
          fields: [{ label: 'Assigned', value: assigned || '⚠️ Unassigned', color: assigned ? '#0f172a' : '#c2410c', strong: true }],
          form: [f.inp('assign', '', { type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), placeholder: 'Select sales person…' })],
          actions: [
            btn('Reassign', () => {
              const n = f.str('assign');
              if (!n) return void f.fail('assign', 'Select a sales person');
              update.mutate({ assignedTo: n }, { onSuccess: () => { f.set('assign', ''); toast('👤 Assigned to ' + (nameOf(n) || 'team member')); } });
            }, 'primary'),
          ],
        },
        personSection('Buyer Info', { name: e.buyerName, phone: e.phone, email: e.email }, [{ label: 'User type', value: e.userType ? e.userType.toUpperCase() : '' }], e.buyerId ? '/admin/users/' + e.buyerId : null, 'View Buyer Profile →', navigate),
        {
          title: 'Quick Actions',
          stack: true,
          actions: [
            btn('📅 Schedule Visit', schedule),
            btn('💬 WhatsApp', () => openCompose({ channel: 'whatsapp', name: e.buyerName, to: e.phone, property: e.propertyTitle, entity })),
            btn('💬 Start Negotiation', negotiate),
            btn('📞 Call', () => callPhone(e.buyerName, e.phone)),
            btn('📧 Send Property Details', sendDetails),
            btn('➡️ Move to Sales Pipeline', toSales, 'primary', { loading: convert.isPending }),
            e.status === 'new' ? btn('✅ Mark as Responded', () => setStatus('responded', '✅ Marked as responded'), 'green') : null,
            e.status !== 'closed'
              ? btn('👎 Mark Not Interested', () => askConfirm({ title: 'Mark as not interested?', message: 'This closes the enquiry. Closed is final and cannot be reopened.', confirmLabel: 'Mark Not Interested', tone: 'destructive', onConfirm: async () => { await update.mutateAsync({ status: 'closed' }); toast('Enquiry closed'); } }), 'red')
              : null,
          ],
        },
        wf.activity(),
        wf.sent(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
