import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { matches, readView, writeView } from '../../../components/tables/listState';
import { Icon } from '../../../components/ui/Icon';
import { PageStack } from '../../../components/ui/ListHeader';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useSession } from '../../../hooks/useSession';
import { useViewport } from '../../../hooks/useViewport';
import { badge, date, initials, price, relativeLong } from '../../../lib/format';
import { listAcquisitions } from '../../../services/acquisitions';
import { listBuyEnquiries, listSellRequests } from '../../../services/enquiries';
import { listSalesDeals } from '../../../services/sales';
import { assignUser, listUsers, setUserBlocked } from '../../../services/users';
import { askConfirm, openCompose, toast } from '../../../store/uiStore';
import type { AdminUser } from '../../../types/users';
import listStyles from '../../../components/ui/ListHeader.module.css';
import { FEMA_ICON } from '../constants';
import styles from './Users.module.css';

type Tab = 'all' | 'buyers' | 'sellers';

interface Stats {
  spent: number;
  activeBuy: boolean;
  pastBuy: boolean;
  highValue: boolean;
  activeSell: boolean;
}

const roleBadges = (u: AdminUser) => (u.role === 'both' ? [badge('Buyer', 'blue'), badge('Seller', 'green')] : u.role === 'buyer' ? [badge('Buyer', 'blue')] : [badge('Seller', 'green')]);
const typeTags = (u: AdminUser) => [u.userType === 'pio' ? badge('PIO', 'indigo') : u.userType === 'nri' ? badge('NRI', 'indigo') : null, u.isBlocked ? badge('Blocked', 'red') : null];

export function UsersList({ tab }: { tab: Tab }) {
  const navigate = useNavigate();
  const { can } = useSession();
  const canBlock = can('users.write') || can('users.kyc.review');
  const { vw } = useViewport();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: ({ signal }) => listUsers(signal) });
  // Segment flags and "Total Spent" are derived from the real pipeline records for each user.
  const dealsQ = useQuery({ queryKey: ['sales-deals'], queryFn: ({ signal }) => listSalesDeals(signal) });
  const enqQ = useQuery({ queryKey: ['buy-enquiries'], queryFn: ({ signal }) => listBuyEnquiries(signal), enabled: tab === 'buyers' });
  const sellQ = useQuery({ queryKey: ['sell-requests'], queryFn: ({ signal }) => listSellRequests(signal), enabled: tab === 'sellers' });
  const acqQ = useQuery({ queryKey: ['acquisitions'], queryFn: ({ signal }) => listAcquisitions(signal), enabled: tab === 'sellers' });
  const { team } = useSalesTeam();
  const block = useRefreshingMutation((v: { id: string; on: boolean; reason?: string | null }) => setUserBlocked(v.id, v.on, v.reason), [['users']]);
  const assign = useRefreshingMutation((v: { id: string; to: string }) => assignUser(v.id, v.to), [['users']]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [chip, setChip] = useState('all');
  const [view, setView] = useState(() => readView('users', 'table'));
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    setSearch('');
    setChip('all');
    setRole('all');
    setMenuId(null);
  }, [tab]);

  const deals = dealsQ.data?.items ?? [];
  const stats = (u: AdminUser): Stats => {
    const mine = deals.filter((d) => d.buyerId === u.id);
    return {
      spent: mine.reduce((t, d) => t + (d.totalPaid || 0), 0),
      activeBuy: mine.some((d) => !['closed', 'lost'].includes(d.stage)) || (enqQ.data?.items ?? []).some((e) => e.buyerId === u.id && e.status !== 'closed'),
      pastBuy: mine.some((d) => d.stage === 'closed'),
      highValue: mine.some((d) => (d.agreedPrice || d.listedPrice) > 5e6),
      activeSell:
        (acqQ.data?.items ?? []).some((a) => a.sellerId === u.id && !['acquired', 'rejected'].includes(a.stage)) ||
        (sellQ.data?.items ?? []).some((r) => r.sellerId === u.id && ['new', 'under_review', 'approved', 'changes_requested'].includes(r.status)),
    };
  };

  const all = usersQ.data?.items ?? [];
  const base = all.filter((u) => (tab === 'buyers' ? u.role !== 'seller' : tab === 'sellers' ? u.role !== 'buyer' : true));
  const withStats = base.map((u) => ({ u, s: stats(u) }));
  const chipDefs: Array<[string, string]> = tab === 'buyers' ? [['all', 'All Buyers'], ['active', 'Active Buyers'], ['past', 'Past Buyers'], ['high', 'High Value (>₹50L)']] : tab === 'sellers' ? [['all', 'All Sellers'], ['active', 'Active Sellers']] : [];
  const chipOk = (k: string, s: Stats) => k === 'all' || (tab === 'buyers' ? (k === 'active' ? s.activeBuy : k === 'past' ? s.pastBuy : s.highValue) : s.activeSell);
  const list = withStats
    .filter((x) => (role === 'all' || x.u.role === role) && chipOk(chip, x.s) && matches(search, x.u.name, x.u.phone, x.u.email, x.u.city))
    .sort((a, b) => (a.u.registeredAt < b.u.registeredAt ? 1 : -1));
  const open = (u: AdminUser) => () => navigate('/admin/users/' + u.id);
  const state = usersQ.isPending ? 'loading' : usersQ.isError ? 'error' : list.length === 0 ? 'empty' : 'normal';
  const empty =
    base.length === 0
      ? { icon: 'users', title: 'No users yet', text: 'Users who register in the BuiltGlory app appear here' }
      : search.trim()
        ? { icon: 'search-x', title: 'No results found', text: 'Try a different name, phone, email or city', action: { label: 'Clear search', onClick: () => setSearch('') } }
        : { icon: 'filter-x', title: 'No users match this filter', text: 'Try a different role or segment', action: { label: 'Clear filter', onClick: () => { setRole('all'); setChip('all'); } } };

  const toggleBlock = (u: AdminUser, s: Stats) => {
    if (u.isBlocked) return block.mutate({ id: u.id, on: false }, { onSuccess: () => toast('✅ ' + u.name + ' unblocked') });
    const hasActive = s.activeBuy || s.activeSell || u.totalDeals > 0;
    askConfirm({
      title: hasActive ? 'Block anyway?' : 'Block user?',
      message: 'Blocking will prevent app access. Active deals will not be affected.' + (hasActive ? '\n\nThis user has active deals or listings.' : ''),
      input: { label: 'Notes (optional)', placeholder: 'Reason for blocking' },
      confirmLabel: 'Confirm Block',
      tone: 'destructive',
      onConfirm: async ({ value }) => {
        await block.mutateAsync({ id: u.id, on: true, reason: value.trim() || null });
        toast('🚫 ' + u.name + ' blocked');
      },
    });
  };

  const rows: Row[] = list.map(({ u, s }) => {
    const fe = u.fema ? FEMA_ICON[u.fema.status] : null;
    const activity = u.totalEnquiries + u.totalVisits + u.totalDeals + u.totalListings;
    return {
      key: u.id,
      onClick: open(u),
      dim: u.isBlocked,
      cells: [
        { initials: initials(u.name), title: u.name, strong: true, sub: u.phone, tags: typeTags(u), icon: fe ? fe[0] : undefined, iconColor: fe ? fe[1] : undefined, iconTitle: fe ? fe[2] : undefined },
        { badges: roleBadges(u), sub: u.userType === 'resident' ? 'Resident' : u.userType.toUpperCase() },
        { title: u.email || 'Not provided', muted: true },
        { title: s.spent ? price(s.spent) : '—', strong: !!s.spent },
        activity ? { title: u.totalEnquiries + ' enq · ' + u.totalVisits + ' visits', sub: u.totalDeals + ' deals · ' + u.totalListings + ' listings' } : { title: 'No activity yet', muted: true },
        { title: u.city || '—', sub: u.country && u.country !== 'India' ? u.country : u.state },
        { title: date(u.registeredAt), muted: true },
        { badges: [u.isBlocked ? badge('Blocked', 'red') : badge('Active', 'green')] },
        { actions: [{ label: 'View', onClick: open(u) }, { icon: 'more-horizontal', title: 'More actions', onClick: () => setMenuId(u.id) }] },
      ],
    };
  });

  const mu = menuId ? all.find((u) => u.id === menuId) : null;
  const done = (fn: () => void) => () => {
    setMenuId(null);
    fn();
  };
  const cardCols = vw >= 1280 ? 'repeat(4, minmax(0, 1fr))' : vw >= 1024 ? 'repeat(3, minmax(0, 1fr))' : vw >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
  const setViewMode = (v: string) => {
    writeView('users', v);
    setView(v);
  };

  return (
    <PageStack>
      <div className={styles.head}>
        <div>
          <div className={styles.titleRow}>
            <h2 className="bg-sr-only">Users</h2>
          </div>
          <p className={styles.lead}>Manage buyers, sellers, and access status</p>
        </div>
        <div className={listStyles.controls}>
          <div className={listStyles.search}>
            <span className={listStyles.searchIcon}><Icon name="search" size={16} /></span>
            <input type="search" className={listStyles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, city…" aria-label="Search users" />
          </div>
          {tab === 'all' && (
            <select className={listStyles.select} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="all">All Roles</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Buyer &amp; Seller</option>
            </select>
          )}
          <div className={listStyles.toggle}>
            {[['table', 'list', 'Table view'], ['cards', 'layout-grid', 'Card view']].map(([v, icon, label]) => (
              <button key={v} type="button" className={listStyles.toggleBtn} title={label} aria-label={label} aria-pressed={view === v} onClick={() => setViewMode(v!)} style={{ background: view === v ? '#2563eb' : '#ffffff', color: view === v ? '#ffffff' : '#64748b' }}>
                <Icon name={icon!} size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {chipDefs.length > 0 && (
        <div className={styles.chips}>
          {chipDefs.map(([k, label]) => {
            const n = withStats.filter((x) => chipOk(k, x.s)).length;
            const on = chip === k;
            return (
              <button key={k} type="button" className={styles.chip} aria-pressed={on} onClick={() => setChip(k)} style={{ borderColor: on ? '#2563eb' : '#e2e8f0', background: on ? '#2563eb' : '#ffffff', color: on ? '#ffffff' : '#334155' }}>
                {label + ' (' + n + ')'}
              </button>
            );
          })}
        </div>
      )}
      {view === 'cards' && state === 'normal' ? (
        <div className={styles.grid} style={{ gridTemplateColumns: cardCols }}>
          {list.map(({ u }) => {
            const sb = u.isBlocked ? badge('Blocked', 'red') : badge('Active', 'green');
            const tags = [...roleBadges(u), ...typeTags(u).filter(Boolean)] as ReturnType<typeof badge>[];
            return (
              <div key={u.id} className={styles.card} role="link" tabIndex={0} onClick={open(u)} onKeyDown={(e) => e.key === 'Enter' && open(u)()} style={{ opacity: u.isBlocked ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={styles.avatar}>{initials(u.name)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className={styles.name}>{u.name}</p>
                    <p className={styles.small}>{u.phone}</p>
                  </div>
                  <span className={styles.pill} style={{ background: sb.bg, color: sb.fg }}>{sb.text}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map((t) => <span key={t.text} className={styles.pill} style={{ background: t.bg, color: t.fg }}>{t.text}</span>)}
                </div>
                <div className={styles.stats}>
                  {[['Enq', u.totalEnquiries], ['Visits', u.totalVisits], ['Deals', u.totalDeals], ['Listings', u.totalListings]].map(([l, v]) => (
                    <div key={l}><p className={styles.statValue}>{v}</p><p className={styles.statLabel}>{l}</p></div>
                  ))}
                </div>
                <div className={styles.meta}>
                  <p>{'📍 ' + (u.city || '—') + (u.country && u.country !== 'India' ? ', ' + u.country : '')}</p>
                  <p>{'Last login ' + (u.lastLoginAt ? relativeLong(u.lastLoginAt) : 'never')}</p>
                </div>
                <span className={styles.cta}>View Profile</span>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={['User', 'Type & Role', 'Email', 'Total Spent', 'Activity', 'Location', 'Registered', 'Status', 'Actions']}
          rows={rows}
          state={state}
          empty={empty}
          onRetry={() => void usersQ.refetch()}
          errorTitle="Could not load users"
          minWidth="1400px"
          footer={list.length + ' users' + (usersQ.data?.truncated ? ' (first ' + all.length + ' of ' + usersQ.data.total + ' loaded)' : '')}
        />
      )}
      {mu && (
        <div className={styles.menuOverlay} onClick={() => setMenuId(null)}>
          <div className={styles.menu} role="menu" onClick={(e) => e.stopPropagation()}>
            <p className={styles.menuTitle}>{mu.name}</p>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={done(() => openCompose({ channel: 'whatsapp', name: mu.name, to: mu.phone, body: 'Hi ' + mu.name.split(' ')[0] + ', this is the BuiltGlory team.', entity: { type: 'user', id: mu.id } }))}>
              <Icon name="message-circle" size={16} />Send WhatsApp
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={done(() => (mu.email ? openCompose({ channel: 'email', name: mu.name, to: mu.email, subject: 'Hello from BuiltGlory', body: 'Hi ' + mu.name.split(' ')[0] + ',\n\n', entity: { type: 'user', id: mu.id } }) : toast('No email on file for ' + mu.name)))}
            >
              <Icon name="mail" size={16} />Send Email
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={done(() =>
                askConfirm({
                  title: 'Assign ' + mu.name,
                  select: { label: 'Assign to', placeholder: 'Select team member', options: team.map((m) => m.name), required: true },
                  confirmLabel: 'Save',
                  onConfirm: async ({ select }) => {
                    const m = team.find((x) => x.name === select);
                    if (!m) throw new Error('Select a team member');
                    await assign.mutateAsync({ id: mu.id, to: m.id });
                    toast('Assigned to ' + m.name);
                  },
                }),
              )}
            >
              <Icon name="user-plus" size={16} />Assign To
            </button>
            {canBlock && <button type="button" role="menuitem" className={styles.menuItem} style={{ color: mu.isBlocked ? '#15803d' : '#dc2626' }} onClick={done(() => toggleBlock(mu, stats(mu)))}>
              <Icon name={mu.isBlocked ? 'unlock' : 'ban'} size={16} />{mu.isBlocked ? 'Unblock' : 'Block'}
            </button>}
          </div>
        </div>
      )}
    </PageStack>
  );
}
