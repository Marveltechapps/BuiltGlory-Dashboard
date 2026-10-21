import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, crumbsFor, personSection, statusBadge } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { badge, price, relativeLong, shortId, statusLabel, todayIso, typeLabel } from '../../../lib/format';
import { callPhone } from '../../../lib/contact';
import { updateAcquisitionStage } from '../../../services/acquisitions';
import { assignSellRequest, createAcquisitionFromSell, getSellRequest, reviewSellRequest, type SellReviewBody } from '../../../services/enquiries';
import { findProperties } from '../../../services/properties';
import { sendPush } from '../../../services/workflow';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';

const REJECT_REASONS = ['Price too high', 'Poor condition', 'Location not suitable', 'Incomplete info', 'Duplicate', 'Other'];

export function SellRequestDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['sell-request', id], queryFn: ({ signal }) => getSellRequest(id, signal), retry: false });
  const r = q.data;
  const { team, nameOf } = useSalesTeam();
  const wf = useWorkflowSections('sell_request', id, f, r?.createdAt);
  const lock = useEditLock('sell_request', id);
  const similarQ = useQuery({ queryKey: ['similar', r?.locality], queryFn: ({ signal }) => findProperties({ locality: r!.locality, limit: 3 }, signal), enabled: !!r?.locality, retry: false });
  const keys = [['sell-request', id], ['sell-requests']];
  const review = useRefreshingMutation((body: SellReviewBody) => reviewSellRequest(id, body), keys);
  const assign = useRefreshingMutation((who: string) => assignSellRequest(id, who), keys);
  const accept = useRefreshingMutation(() => createAcquisitionFromSell(id), [...keys, ['acquisitions']]);

  const state = detailStateOf(q);
  if (state !== 'ok' || !r) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/enquiries/sell" />;

  const first = r.sellerName.split(' ')[0];
  const entity = { type: 'sell_request' as const, id: r.id };
  const assigned = nameOf(r.assignedTo, r.assignedName) || r.assignedName;
  const loc = [r.locality, r.city].filter(Boolean).join(', ');
  const notifySeller = (title: string, body: string) =>
    r.sellerId ? sendPush('sell_request', r.id, { userId: r.sellerId, audience: 'seller', notificationId: 'N-02', template: { title, body } }) : Promise.resolve(null);
  const setStatus = (decision: SellReviewBody['decision'], msg: string, extra: Omit<SellReviewBody, 'decision'> = {}) => review.mutateAsync({ decision, ...extra }).then(() => toast(msg));

  const doAccept = () =>
    accept.mutate(undefined, {
      onSuccess: (a) => {
        toast('✅ Moved to Acquisition Pipeline — ' + a.referenceId);
        if (a.id) navigate('/admin/acquisition/' + a.id);
      },
    });
  const acceptFlow = () => {
    if (r.acquisitionId) return navigate('/admin/acquisition/' + r.acquisitionId);
    if (!r.documents.length) askConfirm({ title: 'No documents uploaded', message: 'Accept anyway and proceed to acquisition review?', confirmLabel: 'Accept anyway', onConfirm: doAccept });
    else askConfirm({ title: 'Accept this property for acquisition review?', message: 'The listing will move to the Acquisition Pipeline pending queue.', confirmLabel: '✅ Accept for Acquisition', tone: 'green', onConfirm: doAccept });
  };
  const reject = () =>
    modal.open({
      title: '❌ Reject Listing',
      fields: [
        { key: 'reason', label: 'Reason', type: 'select', options: REJECT_REASONS, required: true, reqMsg: 'Select a reason' },
        { key: 'notify', label: 'Send rejection to seller', type: 'checkbox', default: true },
      ],
      banners: [{ text: '📱 Notification that will be sent: "Your listing ' + r.title + ' could not be approved."', tone: 'muted' }],
      submit: 'Confirm Reject',
      tone: 'destructive',
      onSubmit: async (v) => {
        await review.mutateAsync({ decision: 'rejected', rejectionReason: String(v.reason), reason: String(v.reason) });
        if (v.notify) await notifySeller('Listing not approved', 'Your listing ' + r.title + ' could not be approved.');
        toast(v.notify ? '✅ Push notification N-02 sent to seller' : 'Listing rejected');
      },
    });
  const requestChanges = (ch: 'whatsapp' | 'email') =>
    openCompose({
      channel: ch,
      name: r.sellerName,
      to: ch === 'email' ? r.email : r.phone,
      entity,
      subject: 'Changes needed — ' + r.title,
      body: 'Hi ' + first + ', please update the following on your listing "' + r.title + '": ',
      onSent: () => review.mutate({ decision: 'changes_requested' }),
    });
  const edit = () =>
    modal.open({
      title: 'Edit Listing',
      subtitle: '📱 App screen: SL-15',
      banners: [{ text: 'Seller-submitted details are edited by the seller in the app — the admin API only allows assignment and review decisions on sell requests. Send the seller a change request instead.', tone: 'warn' }],
      info: [
        { label: 'Property Title', value: r.title },
        { label: 'Price', value: price(r.askingPrice) },
        { label: 'Description', value: r.description },
      ],
      extraActions: [{ label: '📝 Request Changes (WhatsApp)', onClick: () => requestChanges('whatsapp'), variant: 'primary' }],
    });
  const markSold = () =>
    modal.open({
      title: '✅ Mark as Sold',
      fields: [
        { key: 'price', label: 'Final sale price (₹)', type: 'number', required: true },
        { key: 'date', label: 'Sale date', type: 'date', required: true, max: todayIso(), default: todayIso() },
        { key: 'buyer', label: 'Buyer name' },
      ],
      submit: 'Mark as Sold',
      validate: (v) => ({ price: Number(v.price) > 0 ? '' : 'Enter a valid price' }),
      onSubmit: async (v) => {
        await review.mutateAsync({ decision: 'sold', salePrice: Number(v.price), saleDate: String(v.date), saleBuyerName: String(v.buyer || '') || undefined });
        toast('✅ Marked as sold');
        if (r.acquisitionId) {
          askConfirm({
            title: '🔗 Related Acquisition Found',
            message: 'Update acquisition to "Acquired" stage?',
            confirmLabel: 'Yes, update now',
            onConfirm: async () => {
              await updateAcquisitionStage(r.acquisitionId!, 'acquired', { finalPurchasePrice: Number(v.price) });
              toast('🏠 Acquisition updated');
            },
          });
        }
      },
    });
  const pause = () =>
    askConfirm({
      title: 'Pause listing?',
      message: 'Listing will be hidden from app. Seller will be notified.',
      confirmLabel: 'Pause Listing',
      onConfirm: async () => {
        await setStatus('paused', '⏸ Listing paused', { pauseReason: 'Paused by admin' });
        await notifySeller('Your listing was paused', 'Your listing ' + r.title + ' is paused and hidden from the app.');
      },
    });
  const resume = () => void setStatus('approved', '▶ Listing resumed');

  const s = r.specifications;
  const checklist: Array<[string, boolean]> = [
    ['Property details filled', Object.keys(s).length > 0],
    ['Price set', r.askingPrice > 0],
    ['Description', !!r.description],
    ['Location set', !!r.locality],
    ['Amenities selected', r.amenities.length > 0],
  ];
  const similar = (similarQ.data ?? []).filter((p) => !p.isDeleted).slice(0, 3);

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/enquiries/sell"
      crumbs={crumbsFor('Enquiries', '/admin/enquiries/buy', 'Sell Requests', '/admin/enquiries/sell', r.title)}
      title={r.title}
      badges={[statusBadge(r.status), { text: typeLabel(r.type), tone: 'muted' }]}
      meta={shortId(r.id, r.referenceId) + ' • ' + loc + ' • Submitted ' + relativeLong(r.createdAt) + ' • ' + r.completeness + '% complete'}
      hActions={[
        btn('📞 Call Seller', () => callPhone(r.sellerName, r.phone)),
        btn('👁 Preview Listing', () =>
          modal.open({
            title: 'Listing Preview — How buyers see this',
            text: r.title + '\n' + price(r.askingPrice) + ' · ' + loc + '\n\nThis is a preview. Listing is not live yet.',
            extraActions: r.status === 'rejected' || r.status === 'sold' ? [] : [{ label: 'Accept for Acquisition', onClick: acceptFlow, variant: 'primary' }],
          }),
        ),
        btn('👤 ' + (assigned || 'Assign to...'), () =>
          modal.open({
            title: 'Assign to...',
            fields: [{ key: 'who', label: 'Team member', type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), required: true, default: r.assignedTo || '' }],
            onSubmit: async (v) => {
              await assign.mutateAsync(String(v.who));
              toast('👤 Assigned to ' + (nameOf(String(v.who)) || 'team member'));
            },
          }),
        ),
      ]}
      banners={[
        lock,
        r.status === 'paused' ? { text: '⏸ Listing Paused — hidden from app', tone: 'muted', actions: [{ label: '▶ Resume Listing', onClick: resume }] } : null,
        r.duplicateOf ? { text: 'Duplicate listing', tone: 'warn', actions: [{ label: 'View original →', onClick: () => navigate('/admin/enquiries/sell/' + r.duplicateOf) }] } : null,
        r.acquisitionId ? { text: '🏗 In Acquisition Pipeline', tone: 'info', actions: [{ label: 'View acquisition →', onClick: () => navigate('/admin/acquisition/' + r.acquisitionId) }] } : null,
        r.status === 'rejected' && r.rejectionReason ? { text: 'Rejected — ' + r.rejectionReason, tone: 'error' } : null,
      ]}
      main={[
        {
          title: 'Photos',
          images: r.photos,
          empty: r.photos.length ? '' : '📸 No photos uploaded',
          actions: [btn('Request Photos', () => openCompose({ channel: 'whatsapp', name: r.sellerName, to: r.phone, entity, body: 'Hi ' + first + ', please add photos of ' + r.title + ' in the app — listings with photos get 3x more views.' }))],
        },
        {
          title: 'Seller Submitted Details',
          tag: 'App screens: SL-02A to SL-02M',
          fields: [
            { label: 'Address', value: [r.street, r.locality, r.city, r.state, r.pincode].filter(Boolean).join(', ') },
            { label: 'Locality', value: r.locality },
            { label: 'City', value: r.city },
            { label: 'Pincode', value: r.pincode },
            { label: 'Landmark', value: r.landmark },
            { label: 'Asking Price', value: price(r.askingPrice), strong: true },
            { label: 'Negotiable', value: r.negotiable ? 'Yes' : 'No' },
            { label: 'Ownership Type', value: statusLabel(r.ownershipType) },
            { label: 'Possession Status', value: statusLabel(r.possessionStatus) },
            { label: 'Loan on Property', value: r.ownershipType || r.possessionStatus ? (r.loanOnProperty ? 'Yes' : 'No') : '' },
            ...Object.entries(s).slice(0, 8).map(([k, v]) => ({ label: statusLabel(k.replace(/([A-Z])/g, ' $1')), value: v })),
          ],
          banners: [
            r.completeness < 80
              ? { text: 'Consider requesting more details before accepting this listing.', tone: 'warn', action: { label: 'Request Details', onClick: () => requestChanges('whatsapp') } }
              : { text: '✅ All required fields submitted', tone: 'success' },
          ],
        },
        {
          title: 'Documents',
          rows: r.documents.map((d) => ({
            title: d.name,
            badges: [badge(statusLabel(d.status), d.status === 'uploaded' || d.status === 'verified' ? 'blue' : d.status === 'rejected' ? 'red' : 'amber')],
            actions: [d.fileUrl ? { label: 'View', onClick: () => window.open(d.fileUrl, '_blank', 'noopener,noreferrer') } : null],
          })),
          empty: r.documents.length ? '' : 'No documents uploaded',
          actions: [
            btn(r.documents.length ? 'Request Missing Documents' : 'Request Documents', () =>
              openCompose({ channel: 'whatsapp', name: r.sellerName, to: r.phone, entity, body: 'Hi ' + first + ', please upload the sale deed, EC and tax receipts for ' + r.title + '.' }),
            ),
          ],
        },
        { title: "Seller's Description", text: r.description || 'No description provided by the seller.' },
        {
          title: 'Listing Analytics',
          tag: 'App screen: SL-13',
          subtitle: 'Stats visible to seller in their app dashboard',
          cols: 3,
          fields: [
            { label: 'Total Views', value: r.metrics.views, strong: true },
            { label: 'Enquiries', value: r.metrics.enquiryCount },
            { label: 'Visits', value: r.metrics.visitCount },
            { label: 'Saves', value: r.metrics.saveCount },
          ],
          banners: [
            { text: '💡 Consider boosting this listing', tone: 'info', action: { label: 'Boost Listing →', onClick: () => navigate('/admin/tools/pricing') } },
            r.photos.length ? null : { text: '📸 Add photos to increase views by 3x', tone: 'muted' },
            r.askingPrice ? null : { text: '💰 Add price to attract more buyers', tone: 'muted' },
          ],
        },
        wf.notes(),
      ]}
      side={[
        personSection('Seller Info', { name: r.sellerName, phone: r.phone, email: r.email }, [{ label: 'KYC', value: statusLabel(r.kycStatus) }, { label: 'City', value: r.city }], r.sellerId ? '/admin/users/' + r.sellerId : null, 'View Seller Profile →', navigate),
        { title: 'Listing Completeness', subtitle: r.completeness + '%', checks: checklist.map(([label, done]) => ({ label, done })), actions: [btn('Improve completeness', () => requestChanges('whatsapp'))] },
        {
          title: 'Similar in Area',
          subtitle: 'Properties Builtglory already has',
          rows: similar.map((p) => ({ key: p.id, title: p.title, sub: price(p.price), onClick: () => navigate('/admin/properties/' + p.id) })),
          empty: similar.length ? '' : similarQ.isPending && r.locality ? 'Loading…' : 'No similar properties in ' + (r.locality || 'this area'),
        },
        {
          title: 'Review Actions',
          stack: true,
          actions: [
            r.status === 'rejected' || r.status === 'sold' ? null : btn(r.acquisitionId ? '🏗 View Acquisition' : '✅ Accept for Acquisition', acceptFlow, 'green', { loading: accept.isPending }),
            r.status === 'rejected' ? null : btn('❌ Reject Listing', reject, 'red'),
            btn('📝 Request Changes (WhatsApp)', () => requestChanges('whatsapp')),
            btn('📝 Request Changes (Email)', () => requestChanges('email'), 'outline', { disabled: !r.email }),
            r.status === 'new' ? btn('🔍 Mark Under Review', () => void setStatus('under_review', '🔍 Marked under review')) : null,
          ],
        },
        {
          title: 'Quick Actions',
          tag: 'SL-15, SL-17, SL-18',
          stack: true,
          actions: [btn('✏️ Edit Listing Details', edit), r.status === 'paused' ? btn('▶ Resume Listing', resume) : btn('⏸ Pause Listing', pause), r.status === 'sold' ? null : btn('✅ Mark as Sold', markSold)],
        },
        wf.activity(),
        wf.sent(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
