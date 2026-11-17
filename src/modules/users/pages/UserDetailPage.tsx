import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn, contactActions } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useEditLock } from '../../../hooks/useEditLock';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSession } from '../../../hooks/useSession';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { saveBlob } from '../../../lib/apiClient';
import { copyText } from '../../../lib/contact';
import { acqStage, date, price, relativeLong, salesStage, statusBadge, statusLabel } from '../../../lib/format';
import { listAcquisitions } from '../../../services/acquisitions';
import { listBuyEnquiries, listSellRequests, listVisits } from '../../../services/enquiries';
import { listSalesDeals } from '../../../services/sales';
import { assignUser, exportUser, getUser, setUserBlocked, updateUser, updateUserFema, updateUserKyc } from '../../../services/users';
import { sendPush } from '../../../services/workflow';
import { openCompose, toast } from '../../../store/uiStore';
import type { FemaStatus, KycStatus, UserUpdateBody } from '../../../types/users';
import { FEMA_LABEL } from '../constants';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const { can, canAny } = useSession();
  const q = useQuery({ queryKey: ['user', id], queryFn: ({ signal }) => getUser(id, signal), retry: false });
  const u = q.data;
  // History sections are built from the real pipeline lists (shared cache with the list screens).
  const enqQ = useQuery({ queryKey: ['buy-enquiries'], queryFn: ({ signal }) => listBuyEnquiries(signal), enabled: !!u });
  const visQ = useQuery({ queryKey: ['visits'], queryFn: ({ signal }) => listVisits(signal), enabled: !!u });
  const dealsQ = useQuery({ queryKey: ['sales-deals'], queryFn: ({ signal }) => listSalesDeals(signal), enabled: !!u });
  const sellQ = useQuery({ queryKey: ['sell-requests'], queryFn: ({ signal }) => listSellRequests(signal), enabled: !!u && u.role !== 'buyer' });
  const acqQ = useQuery({ queryKey: ['acquisitions'], queryFn: ({ signal }) => listAcquisitions(signal), enabled: !!u && u.role !== 'buyer' });
  const { team, nameOf } = useSalesTeam();
  const wf = useWorkflowSections('user', id, f, u?.registeredAt);
  const lock = useEditLock('user', id);
  const keys = [['user', id], ['users']];
  const update = useRefreshingMutation((body: UserUpdateBody) => updateUser(id, body), keys);
  const block = useRefreshingMutation((v: { on: boolean; reason?: string | null }) => setUserBlocked(id, v.on, v.reason), keys);
  const assign = useRefreshingMutation((to: string) => assignUser(id, to), keys);
  const fema = useRefreshingMutation((v: { status: FemaStatus; notes?: string | null }) => updateUserFema(id, v.status, v.notes), keys);
  const kyc = useRefreshingMutation((v: { status: KycStatus; notes?: string | null }) => updateUserKyc(id, v.status, v.notes), keys);
  const push = useRefreshingMutation((v: { title: string; body: string; audience: 'buyer' | 'seller' }) => sendPush('user', id, { userId: id, audience: v.audience, notificationId: 'admin_manual', template: { title: v.title, body: v.body } }), [['logs', 'user', id], ['timeline', 'user', id]]);
  const exportData = useRefreshingMutation(() => exportUser(id), []);

  const state = detailStateOf(q);
  if (state !== 'ok' || !u) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/users/all" nfTitle="User not found" />;

  const enq = (enqQ.data?.items ?? []).filter((e) => e.buyerId === u.id);
  const vis = (visQ.data?.items ?? []).filter((v) => v.buyerId === u.id);
  const deals = (dealsQ.data?.items ?? []).filter((d) => d.buyerId === u.id);
  const lists = (sellQ.data?.items ?? []).filter((r) => r.sellerId === u.id);
  const acqs = (acqQ.data?.items ?? []).filter((a) => a.sellerId === u.id);
  const loading = (x: { isPending: boolean; fetchStatus: string }) => x.isPending && x.fetchStatus !== 'idle';
  const canAssign = can('users.write');
  const canEdit = can('users.write');
  const canBlock = can('users.write') || can('users.kyc.review');
  const canPush = canAny(['users.write', 'support.write', 'properties.write', 'sales.write', 'enquiries.write', 'acquisitions.write', 'visits.write', 'admin.access.manage']);
  const nri = u.userType !== 'resident';
  const first = u.name.split(' ')[0];
  const assignedName = nameOf(u.assignedTo, u.assignedToName) || u.assignedToName || (u.assignedTo ? 'Assigned' : 'Unassigned');
  const femaStatus = u.fema?.status || 'not_checked';

  const toggleBlock = () => {
    if (u.isBlocked) return block.mutate({ on: false }, { onSuccess: () => toast('✅ ' + u.name + ' unblocked') });
    const active = deals.some((d) => !['closed', 'lost'].includes(d.stage));
    modal.open({
      title: '🚫 Block User',
      text: 'Blocking will prevent app access. Active deals will not be affected.' + (active ? '\n\nThis user has active deals — Block anyway?' : ''),
      fields: [{ key: 'notes', label: 'Notes (optional)', type: 'textarea' }],
      submit: 'Confirm Block',
      tone: 'destructive',
      onSubmit: async (v) => {
        await block.mutateAsync({ on: true, reason: String(v.notes || '').trim() || null });
        toast('🚫 ' + u.name + ' blocked');
      },
    });
  };

  const sendPushModal = () =>
    modal.open({
      title: '🔔 Send Push Notification',
      fields: [
        { key: 't', label: 'Title', required: true },
        { key: 'm', label: 'Message', type: 'textarea', required: true },
      ],
      submit: 'Send',
      onSubmit: async (v) => {
        await push.mutateAsync({ title: String(v.t), body: String(v.m), audience: u.role === 'seller' ? 'seller' : 'buyer' });
        toast('🔔 Push sent to ' + u.name);
      },
    });

  const assignModal = () =>
    modal.open({
      title: 'Assign To admin',
      fields: [{ key: 'w', label: 'Assign to', type: 'select', options: team.map((m) => ({ value: m.id, label: m.name })), default: u.assignedTo || '', required: true }],
      submit: 'Save',
      onSubmit: async (v) => {
        await assign.mutateAsync(String(v.w));
        toast('👤 Assigned to ' + (nameOf(String(v.w)) || 'team member'));
      },
    });

  const editProfile = () =>
    modal.open({
      title: 'Edit Profile',
      formCols: 2,
      wide: true,
      fields: [
        { key: 'name', label: 'Full Name', default: u.name, required: true },
        { key: 'email', label: 'Email', default: u.email || '' },
        { key: 'city', label: 'City', default: u.city },
        { key: 'state', label: 'State', default: u.state },
        { key: 'country', label: 'Country', default: u.country },
        { key: 'type', label: 'User Type', type: 'select', options: ['resident', 'nri', 'pio'], default: u.userType },
      ],
      validate: (v) => ({ email: v.email && !/^\S+@\S+\.\S+$/.test(String(v.email)) ? 'Enter a valid email' : '', name: String(v.name || '').trim().length < 2 ? 'Name must be at least 2 characters' : '' }),
      submit: 'Save Changes',
      onSubmit: async (v) => {
        await update.mutateAsync({
          name: String(v.name).trim(),
          email: String(v.email || '').trim() || null,
          city: String(v.city || '') || null,
          state: String(v.state || '') || null,
          country: String(v.country || '') || null,
          userType: String(v.type) as UserUpdateBody['userType'],
        });
        toast('✅ Profile updated');
      },
    });

  const setFema = (s: FemaStatus) => fema.mutate({ status: s }, { onSuccess: () => toast(FEMA_LABEL[s] || s) });
  const setKyc = (status: KycStatus, notes?: string) => kyc.mutate({ status, notes }, { onSuccess: () => toast('KYC ' + statusLabel(status)) });

  const doExport = () =>
    exportData.mutate(undefined, {
      onSuccess: (data) => {
        saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'user-' + (u.referenceId || u.id) + '.json');
        toast('📥 Exported ' + u.name + ' data (JSON)');
      },
    });

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/users/all"
      crumbs={[{ label: 'Users', path: '/admin/users/all' }, { label: u.name }]}
      title={u.name}
      badges={[
        u.role === 'both' ? { text: 'Buyer & Seller', tone: 'blue' } : { text: statusLabel(u.role), tone: u.role === 'buyer' ? 'blue' : 'green' },
        nri ? { text: u.userType.toUpperCase(), tone: 'indigo' } : null,
        u.isBlocked ? { text: 'Blocked', tone: 'red' } : { text: 'Active', tone: 'green' },
      ]}
      meta={u.referenceId + ' • ' + u.phone + ' • Registered ' + date(u.registeredAt) + ' • Last login ' + (u.lastLoginAt ? relativeLong(u.lastLoginAt) : 'never')}
      banners={[lock, u.isBlocked ? { text: '🚫 This user is blocked' + (u.blockedReason ? ' — ' + u.blockedReason : ''), tone: 'error', actions: canBlock ? [{ label: 'Unblock', onClick: toggleBlock }] : [] } : null]}
      hActions={[
        ...contactActions({ name: u.name, phone: u.phone, email: u.email, entity: { type: 'user', id: u.id } }),
        btn('👤 Assign To admin', assignModal, 'outline', { disabled: !canAssign, title: canAssign ? '' : 'You do not have permission to change assignment.' }),
        btn('🔔 Send Push Notification', sendPushModal, 'outline', { disabled: !canPush, title: canPush ? '' : 'You do not have permission to send a push.' }),
        btn('📥 Export User Data', doExport, 'outline', { loading: exportData.isPending }),
      ]}
      main={[
        {
          title: 'Activity Summary',
          cols: 3,
          fields: [
            { label: 'Enquiries', value: enqQ.data ? enq.length : u.totalEnquiries, strong: true },
            { label: 'Visits', value: visQ.data ? vis.length : u.totalVisits, strong: true },
            { label: 'Deals', value: dealsQ.data ? deals.length : u.totalDeals, strong: true },
            { label: 'Listings', value: sellQ.data || acqQ.data ? lists.length + acqs.length : u.totalListings, strong: true },
          ],
        },
        {
          title: 'Enquiry History',
          tag: 'App screen: B-10, P-02',
          rows: enq.map((e) => ({ key: e.id, title: e.propertyTitle, sub: relativeLong(e.createdAt), badges: [statusBadge(e.status)], onClick: () => navigate('/admin/enquiries/buy/' + e.id), actions: [{ label: 'View →', onClick: () => navigate('/admin/enquiries/buy/' + e.id) }] })),
          empty: enq.length ? '' : loading(enqQ) ? 'Loading…' : enqQ.isError ? 'Could not load enquiries' : 'No enquiries yet',
        },
        {
          title: 'Visit History',
          tag: 'App screen: B-12, P-03',
          rows: vis.map((v) => ({ key: v.id, title: v.propertyTitle, sub: date(v.visitDate + 'T12:00:00') + ' · ' + v.visitTime + ' · ' + statusLabel(v.visitType), badges: [statusBadge(v.status)], onClick: () => navigate('/admin/visits/' + v.id) })),
          empty: vis.length ? '' : loading(visQ) ? 'Loading…' : visQ.isError ? 'Could not load visits' : 'No visits yet',
        },
        {
          title: 'Deal History',
          tag: 'App screen: P-04',
          rows: deals.map((d) => ({ key: d.id, title: d.propertyTitle, sub: salesStage(d.stage) + ' · ' + price(d.agreedPrice || d.listedPrice), onClick: () => navigate('/admin/sales/' + d.id), actions: [{ label: 'View Deal →', onClick: () => navigate('/admin/sales/' + d.id) }] })),
          empty: deals.length ? '' : loading(dealsQ) ? 'Loading…' : dealsQ.isError ? 'Could not load deals' : 'No deals yet',
        },
        {
          title: 'Property Listings',
          tag: 'App screen: SL-02, P-05',
          rows: [
            ...lists.map((r) => ({ key: r.id, title: r.title, sub: price(r.askingPrice), badges: [statusBadge(r.status)], onClick: () => navigate('/admin/enquiries/sell/' + r.id) })),
            ...acqs.map((a) => ({ key: a.id, title: a.title, sub: 'Acquisition · ' + acqStage(a.stage), onClick: () => navigate('/admin/acquisition/' + a.id) })),
          ],
          empty: lists.length + acqs.length ? '' : u.role === 'buyer' ? 'No listings yet' : loading(sellQ) || loading(acqQ) ? 'Loading…' : 'No listings yet',
        },
        {
          title: 'KYC review',
          subtitle: 'Review the customer identity documents',
          fields: [{ label: 'Status', value: statusLabel(u.kycStatus), strong: true }],
          actions: [
            btn('Mark verified', () => setKyc('verified'), 'green', { disabled: !can('users.kyc.review'), loading: kyc.isPending }),
            btn('Mark pending', () => setKyc('pending'), 'outline', { disabled: !can('users.kyc.review'), loading: kyc.isPending }),
            btn('Mark rejected', () => setKyc('rejected', 'Rejected by reviewer'), 'red', { disabled: !can('users.kyc.review'), loading: kyc.isPending }),
          ],
        },
        nri
          ? {
              title: 'FEMA Compliance for NRI / PIO',
              subtitle: 'Required for NRI/PIO property purchases',
              fields: [
                { label: 'Status', value: FEMA_LABEL[femaStatus], strong: true, color: femaStatus === 'compliant' ? '#15803d' : femaStatus === 'non_compliant' ? '#dc2626' : '#b45309' },
                u.fema?.checkedAt ? { label: 'Checked', value: date(u.fema.checkedAt) + (u.fema.checkedBy ? ' · ' + u.fema.checkedBy : '') } : null,
              ],
              banners: femaStatus === 'non_compliant' ? [{ text: 'Cannot purchase until resolved', tone: 'error' }] : [],
              formCols: 1,
              form: [f.inp('fema.n', 'FEMA notes', { type: 'textarea', default: u.fema?.notes || '', placeholder: 'FEMA notes…' })],
              actions: [
                btn('✅ Mark Compliant', () => setFema('compliant'), 'green', { disabled: !can('users.fema.review') }),
                btn('❌ Mark Non-Compliant', () => setFema('non_compliant'), 'red', { disabled: !can('users.fema.review') }),
                btn('⏳ Under Review', () => setFema('under_review'), 'outline', { disabled: !can('users.fema.review') }),
                femaStatus === 'non_compliant' ? btn('Mark Resolved', () => setFema('compliant')) : null,
                btn('Save Notes', () => fema.mutate({ status: femaStatus, notes: f.str('fema.n', u.fema?.notes || '') }, { onSuccess: () => toast('Notes saved') }), 'outline', { loading: fema.isPending }),
              ],
            }
          : null,
        u.profilePhoto ? { title: 'Profile Photo', images: [u.profilePhoto], subtitle: 'Photos uploaded via app P-07' } : { title: 'Profile Photo', text: 'No profile photo', subtitle: 'Photos uploaded via app P-07' },
        wf.activity('Activity Timeline'),
      ]}
      sideW="320px"
      side={[
        {
          title: 'Profile',
          cols: 1,
          fields: [
            { label: 'Phone', value: u.phone },
            { label: 'Email', value: u.email },
            { label: 'User Type', value: u.userType.toUpperCase() },
            { label: 'Role', value: statusLabel(u.role) },
            { label: 'Country', value: u.country },
            { label: 'City', value: u.city },
            { label: 'Registered', value: date(u.registeredAt) },
            { label: 'Last Login', value: u.lastLoginAt ? relativeLong(u.lastLoginAt) : 'Never' },
            { label: 'Status', value: u.isBlocked ? 'Blocked' : 'Active' },
            { label: 'Assigned To', value: assignedName },
          ],
          actions: [btn('📋 Copy phone', () => void copyText(u.phone), 'outline', { disabled: !u.phone }), btn('Edit Profile', editProfile, 'primary', { disabled: !canEdit, title: canEdit ? '' : 'You do not have permission to edit this profile.' })],
        },
        {
          title: 'Actions',
          stack: true,
          actions: [
            btn('📱 Send WhatsApp', () => openCompose({ channel: 'whatsapp', name: u.name, to: u.phone, body: 'Hi ' + first + ', this is the BuiltGlory team.', entity: { type: 'user', id: u.id } })),
            btn('📧 Send Email', () => openCompose({ channel: 'email', name: u.name, to: u.email, subject: 'Hello from BuiltGlory', body: 'Hi ' + first + ',\n\n', entity: { type: 'user', id: u.id } }), 'outline', { disabled: !u.email }),
            btn('🔔 Send Push Notification', sendPushModal, 'outline', { disabled: !canPush, title: canPush ? '' : 'You do not have permission to send a push.' }),
            btn(u.isBlocked ? '✅ Unblock User' : '🚫 Block User', toggleBlock, u.isBlocked ? 'green' : 'red', { loading: block.isPending, disabled: !canBlock, title: canBlock ? '' : 'You do not have permission to block this user.' }),
          ],
        },
        wf.notes('Admin Notes', 'Visible to admins only'),
        {
          title: 'Assignment',
          cols: 1,
          fields: [{ label: 'From:', value: assignedName }],
          banners: canAssign ? [] : [{ text: 'You do not have permission to change assignment.', tone: 'muted' }],
          actions: canAssign ? [btn('Change assignment', assignModal)] : [],
        },
        wf.sent(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
