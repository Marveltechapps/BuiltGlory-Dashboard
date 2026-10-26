import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Cell, type Row } from '../../../components/tables/DataTable';
import { emptyFor, matches, tableStateOf } from '../../../components/tables/listState';
import { InnerTabs, ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { BUDGET_LABEL, STYLE_LABEL } from '../../../constants/enquiries';
import { useDesigners } from '../../../hooks/useTeam';
import { reachOut } from '../../../lib/contact';
import { initials, statusLabel } from '../../../lib/format';
import type { InteriorLead } from '../../../types/enquiries';
import { useInteriorLeads } from '../hooks/useEnquiries';
import { enqBadge, statusTabs } from './enquiryHelpers';

const H = 36e5;

function slaOf(l: InteriorLead): Cell {
  if (l.status !== 'new') return { title: 'Responded', muted: true };
  const deadline = l.slaDeadline ? Date.parse(l.slaDeadline) : Date.parse(l.createdAt) + 24 * H;
  const rem = deadline - Date.now();
  if (rem <= 0) return { title: 'OVERDUE', color: '#dc2626', bold: true, sub: Math.round(-rem / H) + 'h past 24h SLA' };
  return { title: Math.max(1, Math.round(rem / H)) + 'h left', color: rem < 4 * H ? '#d97706' : '#16a34a', strong: true, sub: '24h SLA' };
}

export function InteriorLeadsTab() {
  const navigate = useNavigate();
  const q = useInteriorLeads();
  const { nameOf } = useDesigners();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const all = (q.data?.items ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const list = all.filter((l) => (status === 'all' || l.status === status) && matches(search, l.buyerName, l.phone, l.propertyTitle));
  const open = (l: InteriorLead) => () => navigate('/admin/enquiries/interior/' + l.id);
  const designer = (l: InteriorLead) => nameOf(l.assignedDesigner, l.designerName) || l.designerName;

  const rows: Row[] = list.map((l) => ({
    key: l.id,
    onClick: open(l),
    cells: [
      { initials: initials(l.buyerName), title: l.buyerName, strong: true, sub: l.phone },
      { title: l.propertyTitle, muted: true, wrap: true },
      { title: l.rooms.join(', ') || '—', sub: (STYLE_LABEL[l.style] || statusLabel(l.style)) + ' · ' + (BUDGET_LABEL[l.budget] || statusLabel(l.budget)) + ' budget', wrap: true },
      slaOf(l),
      { badges: [enqBadge('interior', l.status)] },
      { title: designer(l) || '⚠️ No designer', color: designer(l) ? undefined : '#c2410c' },
      { actions: [
        { icon: 'message-circle', title: 'WhatsApp', variant: 'green', onClick: () => reachOut('whatsapp', { name: l.buyerName, to: l.phone, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }) },
        { icon: 'mail', title: 'Email', onClick: () => reachOut('email', { name: l.buyerName, to: l.email, property: l.propertyTitle, entity: { type: 'interior_lead', id: l.id } }) },
        { label: 'View', onClick: open(l) },
      ] },
    ],
  }));

  return (
    <PageStack>
      <ListHeader title="Interior Leads" count={String(all.length)} search={{ value: search, onChange: setSearch, placeholder: 'Search leads...' }} />
      <InnerTabs tabs={statusTabs('interior', all, (l) => l.status, status, setStatus)} />
      <DataTable
        columns={['Buyer', 'Property', 'Requirements', 'SLA', 'Status', 'Assigned', 'Actions']}
        rows={rows}
        state={tableStateOf(q, list)}
        minWidth="1080px"
        errorTitle="Could not load interior leads"
        onRetry={() => void q.refetch()}
        empty={emptyFor(all.length, list.length, search, { icon: 'inbox', title: 'No interior leads yet', text: 'Interior design requests from app appear here (INT-04)' }, () => setSearch(''), () => setStatus('all'))}
      />
    </PageStack>
  );
}
