import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { emptyFor, matches, readView, tableStateOf, writeView } from '../../../components/tables/listState';
import { InnerTabs, ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { reachOut } from '../../../lib/contact';
import { initials, price, relativeLong, typeLabel } from '../../../lib/format';
import type { SellRequest } from '../../../types/enquiries';
import { useSellRequests } from '../hooks/useEnquiries';
import { EntityCards, type EntityCard } from './EntityCards';
import { enqBadge, statusTabs } from './enquiryHelpers';
import { SellPreviewModal } from './SellPreviewModal';

export function SellRequestsTab() {
  const navigate = useNavigate();
  const q = useSellRequests();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState(() => readView('sell', 'table'));
  const [previewId, setPreviewId] = useState<string | null>(null);

  const all = (q.data?.items ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const list = all.filter((r) => (status === 'all' || r.status === status) && matches(search, r.sellerName, r.phone, r.title, r.locality));
  const state = tableStateOf(q, list);
  const open = (r: SellRequest) => () => navigate('/admin/enquiries/sell/' + r.id);
  const loc = (r: SellRequest) => [r.locality, r.city].filter(Boolean).join(', ');
  const preview = all.find((r) => r.id === previewId);
  const setViewMode = (v: string) => {
    writeView('sell', v);
    setView(v);
  };

  const rows: Row[] = list.map((r) => ({
    key: r.id,
    onClick: open(r),
    cells: [
      {
        initials: initials(r.sellerName),
        title: r.sellerName,
        strong: true,
        sub: r.phone,
        flags: [
          r.duplicateOf ? { text: 'Duplicate · View original', bg: '#fef3c7', fg: '#92400e', onClick: () => navigate('/admin/enquiries/sell/' + r.duplicateOf) } : null,
          r.photos.length === 0 ? { text: 'No photos', bg: '#f1f5f9', fg: '#64748b' } : null,
        ],
      },
      { title: r.title, sub: price(r.askingPrice) + ' · ' + loc(r), wrap: true },
      { progress: r.completeness },
      { badges: [enqBadge('sell', r.status)] },
      { title: relativeLong(r.createdAt), muted: true },
      {
        actions: [
          { icon: 'message-circle', title: 'WhatsApp', variant: 'green', onClick: () => reachOut('whatsapp', { name: r.sellerName, to: r.phone, property: r.title, entity: { type: 'sell_request', id: r.id } }) },
          { icon: 'mail', title: 'Email', onClick: () => reachOut('email', { name: r.sellerName, to: r.email, property: r.title, entity: { type: 'sell_request', id: r.id } }) },
          { label: 'Preview', onClick: () => setPreviewId(r.id) },
          { label: 'View', onClick: open(r) },
        ],
      },
    ],
  }));

  const cards: EntityCard[] = list.map((r) => ({
    key: r.id,
    initials: initials(r.sellerName),
    title: r.sellerName,
    sub: r.phone,
    status: enqBadge('sell', r.status),
    prop: r.title,
    propSub: price(r.askingPrice) + ' · ' + r.locality,
    open: open(r),
    cta: 'View Details',
    lines: [
      { label: 'Completeness', value: r.completeness + '%', color: r.completeness >= 80 ? '#15803d' : r.completeness >= 50 ? '#b45309' : '#b91c1c' },
      { label: 'Type', value: typeLabel(r.type) },
      { label: 'Documents', value: r.documents.length ? r.documents.length + ' uploaded' : 'None' },
      { label: 'Submitted', value: relativeLong(r.createdAt) },
    ],
    flags: r.duplicateOf ? [{ text: 'Duplicate', bg: '#fef3c7', fg: '#92400e' }] : [],
    actions: [
      { icon: 'message-circle', label: 'WhatsApp', color: '#15803d', onClick: () => reachOut('whatsapp', { name: r.sellerName, to: r.phone, property: r.title, entity: { type: 'sell_request', id: r.id } }) },
      { icon: 'mail', label: 'Email', color: '#0f172a', onClick: () => reachOut('email', { name: r.sellerName, to: r.email, property: r.title, entity: { type: 'sell_request', id: r.id } }) },
      { icon: 'eye', label: 'Preview', color: '#0f172a', onClick: () => setPreviewId(r.id) },
    ],
  }));

  return (
    <PageStack>
      <ListHeader
        title="Sell Requests"
        count={String(all.length)}
        search={{ value: search, onChange: setSearch, placeholder: 'Search seller, phone, property...' }}
        toggle={[
          { label: 'Table view', icon: 'list', active: view === 'table', onClick: () => setViewMode('table') },
          { label: 'Card view', icon: 'layout-grid', active: view === 'cards', onClick: () => setViewMode('cards') },
        ]}
      />
      <InnerTabs tabs={statusTabs('sell', all, (r) => r.status, status, setStatus)} />
      {view === 'cards' && state === 'normal' ? (
        <EntityCards cards={cards} />
      ) : (
        <DataTable
          columns={['Seller', 'Property', 'Completeness', 'Status', 'Submitted', 'Actions']}
          rows={rows}
          state={state}
          minWidth="1040px"
          errorTitle="Could not load sell requests"
          onRetry={() => void q.refetch()}
          empty={emptyFor(all.length, list.length, search, { icon: 'inbox', title: 'No sell requests yet', text: 'Property listings submitted by sellers in the app will appear here' }, () => setSearch(''), () => setStatus('all'))}
          footer={q.data?.truncated ? `Showing ${all.length} of ${q.data.total} sell requests` : undefined}
        />
      )}
      {preview && <SellPreviewModal r={preview} onClose={() => setPreviewId(null)} />}
    </PageStack>
  );
}
