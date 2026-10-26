import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { emptyFor, matches, readView, tableStateOf, writeView } from '../../../components/tables/listState';
import { InnerTabs, ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { CONTACT_ICON, INTEREST } from '../../../constants/enquiries';
import { useSalesTeam } from '../../../hooks/useTeam';
import { reachOut } from '../../../lib/contact';
import { badge, initials, price, relativeLong, typeLabel } from '../../../lib/format';
import type { BuyEnquiry } from '../../../types/enquiries';
import { useBuyEnquiries } from '../hooks/useEnquiries';
import { EntityCards, type EntityCard } from './EntityCards';
import { enqBadge, statusOptions, statusTabs, visitPrefLabel } from './enquiryHelpers';

const D = 864e5;

export function BuyEnquiriesTab() {
  const navigate = useNavigate();
  const q = useBuyEnquiries();
  const { nameOf } = useSalesTeam();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [statusSel, setStatusSel] = useState('all');
  const [view, setView] = useState(() => readView('buy', 'table'));

  const all = (q.data?.items ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const statusF = statusSel !== 'all' ? statusSel : status;
  const list = all.filter((e) => (statusF === 'all' || e.status === statusF) && matches(search, e.buyerName, e.phone));
  const assignee = (e: BuyEnquiry) => nameOf(e.assignedTo, e.assignedName) || e.assignedName;
  const open = (e: BuyEnquiry) => () => navigate('/admin/enquiries/buy/' + e.id);
  const wa = (e: BuyEnquiry) => () => reachOut('whatsapp', { name: e.buyerName, to: e.phone, property: e.propertyTitle, entity: { type: 'buy_enquiry', id: e.id } });
  const mail = (e: BuyEnquiry) => () => reachOut('email', { name: e.buyerName, to: e.email, property: e.propertyTitle, entity: { type: 'buy_enquiry', id: e.id } });
  const flagsOf = (e: BuyEnquiry) => [
    e.status === 'new' && Date.now() - Date.parse(e.createdAt) > 7 * D ? { text: 'No response 7d+', bg: '#fee2e2', fg: '#b91c1c' } : null,
    e.duplicateOf ? { text: 'Duplicate · View original', bg: '#fef3c7', fg: '#92400e', onClick: () => navigate('/admin/enquiries/buy/' + e.duplicateOf) } : null,
  ];
  const interest = (e: BuyEnquiry) => INTEREST[e.interest] ?? ['Details', 'muted'];
  const state = tableStateOf(q, list);
  const setViewMode = (v: string) => {
    writeView('buy', v);
    setView(v);
  };

  const rows: Row[] = list.map((e) => ({
    key: e.id,
    onClick: open(e),
    cells: [
      { initials: initials(e.buyerName), title: e.buyerName, strong: true, sub: e.phone, icon: CONTACT_ICON[e.preferredContact], iconTitle: 'Prefers ' + e.preferredContact, flags: flagsOf(e), tags: e.userType !== 'resident' ? [badge(e.userType.toUpperCase(), 'indigo')] : [] },
      { title: e.propertyTitle, sub: price(e.propertyPrice) + ' · ' + typeLabel(e.propertyType), wrap: true },
      { badges: [badge(interest(e)[0], interest(e)[1])] },
      { title: visitPrefLabel(e), muted: true },
      { badges: [enqBadge('buy', e.status)] },
      assignee(e) ? { title: assignee(e) } : { title: '⚠️ Unassigned', color: '#c2410c', strong: true },
      { title: relativeLong(e.createdAt), muted: true },
      {
        actions: [
          { icon: 'message-circle', title: 'WhatsApp', variant: 'green', onClick: wa(e) },
          { icon: 'mail', title: 'Email', onClick: mail(e) },
          { label: 'View', onClick: open(e) },
        ],
      },
    ],
  }));

  const cards: EntityCard[] = list.map((e) => ({
    key: e.id,
    initials: initials(e.buyerName),
    title: e.buyerName,
    sub: e.phone,
    status: enqBadge('buy', e.status),
    prop: e.propertyTitle,
    propSub: price(e.propertyPrice),
    open: open(e),
    cta: 'View Details',
    lines: [
      { label: 'Interest', value: interest(e)[0] },
      { label: 'Preferred visit', value: visitPrefLabel(e) },
      { label: 'Assigned', value: assignee(e) || '⚠️ Unassigned', color: assignee(e) ? '#0f172a' : '#c2410c' },
      { label: 'Submitted', value: relativeLong(e.createdAt) },
    ],
    flags: flagsOf(e).filter((f): f is NonNullable<typeof f> => !!f).map(({ text, bg, fg }) => ({ text, bg, fg })),
    actions: [
      { icon: 'message-circle', label: 'WhatsApp', color: '#15803d', onClick: wa(e) },
      { icon: 'mail', label: 'Email', color: '#0f172a', onClick: mail(e) },
    ],
  }));

  return (
    <PageStack>
      <ListHeader
        title="Buy Enquiries"
        count={String(all.length)}
        search={{ value: search, onChange: setSearch, placeholder: 'Search name or phone...' }}
        selects={[{ label: 'Status', value: statusSel, onChange: setStatusSel, options: statusOptions('buy') }]}
        toggle={[
          { label: 'Table view', icon: 'list', active: view === 'table', onClick: () => setViewMode('table') },
          { label: 'Card view', icon: 'layout-grid', active: view === 'cards', onClick: () => setViewMode('cards') },
        ]}
      />
      <InnerTabs tabs={statusTabs('buy', all, (e) => e.status, status, setStatus)} />
      {view === 'cards' && state === 'normal' ? (
        <EntityCards cards={cards} />
      ) : (
        <DataTable
          columns={['Buyer', 'Property', 'Interest', 'Preferred Visit', 'Status', 'Assigned To', 'Submitted', 'Actions']}
          rows={rows}
          state={state}
          minWidth="1120px"
          errorTitle="Could not load enquiries"
          onRetry={() => void q.refetch()}
          empty={emptyFor(all.length, list.length, search, { icon: 'inbox', title: 'No enquiries yet', text: 'Buyer enquiries from the app will appear here', noResults: 'Try a different name or phone number' }, () => setSearch(''), () => { setStatus('all'); setStatusSel('all'); })}
          footer={q.data?.truncated ? `Showing ${all.length} of ${q.data.total} enquiries` : undefined}
        />
      )}
    </PageStack>
  );
}
