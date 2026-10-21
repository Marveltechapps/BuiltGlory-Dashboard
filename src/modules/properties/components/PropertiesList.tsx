import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { matches, readView, writeView } from '../../../components/tables/listState';
import { Icon } from '../../../components/ui/Icon';
import { ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { useViewport } from '../../../hooks/useViewport';
import { saveBlob } from '../../../lib/apiClient';
import { addDaysIso, badge, date, num, price, relativeLong, todayIso, typeLabel } from '../../../lib/format';
import { writeWorkbook } from '../../../lib/xlsx';
import { askConfirm, toast } from '../../../store/uiStore';
import type { Property } from '../../../types/properties';
import { FILTER_TYPES, PROPERTY_STATUS, areaOf, bhkOf, displayStatus, isOnApp } from '../constants';
import { useProperties, usePropertyActions } from '../hooks/useProperties';
import styles from './Properties.module.css';

type ListTab = 'all' | 'featured' | 'upcoming';

const stB = (s: string) => badge((PROPERTY_STATUS[s] ?? [s, 'muted'])[0], (PROPERTY_STATUS[s] ?? [s, 'muted'])[1]);
const launchDay = (p: Property) => (p.launchDate ? p.launchDate.slice(0, 10) : '');

/** Spreadsheet export of real property records (client-side .xlsx; no export endpoint exists for properties). */
function exportProperties(list: Property[], fileName: string) {
  const head = ['Reference ID', 'Title', 'Type', 'Status', 'Price (₹)', 'Negotiable', 'Locality', 'City', 'State', 'Pincode', 'Featured', 'Upcoming', 'Launch Date', 'On App', 'Views', 'Enquiries', 'Visits', 'Saves', 'Comparisons', 'Added'];
  const rows = list.map((p) => [
    p.referenceId, p.title, typeLabel(p.type), (PROPERTY_STATUS[displayStatus(p)] ?? [p.status])[0], p.price, p.isNegotiable ? 'Yes' : 'No', p.locality, p.city, p.state, p.pincode,
    p.isFeatured ? 'Yes' : 'No', p.isUpcoming ? 'Yes' : 'No', launchDay(p), isOnApp(p) ? 'Live' : 'Hidden', p.views, p.enquiries, p.visits, p.saves, p.compareCount, date(p.createdAt),
  ]);
  saveBlob(writeWorkbook([{ name: 'Properties', rows: [head, ...rows] }]), fileName);
}

export function PropertiesList({ tab }: { tab: ListTab }) {
  const navigate = useNavigate();
  const { vw } = useViewport();
  const q = useProperties();
  const act = usePropertyActions();
  const [search, setSearch] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [statusF, setStatusF] = useState('all');
  const [view, setView] = useState(() => readView('properties', 'list'));
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    setSearch('');
    setSelected({});
    setPage(1);
    setMenuId(null);
  }, [tab]);

  const today = todayIso();
  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const active = items.filter((p) => !p.isDeleted);
  const deleted = items.filter((p) => p.isDeleted);
  const base = active.filter((p) => (tab === 'featured' ? p.isFeatured : tab === 'upcoming' ? p.isUpcoming : true));
  const list = base
    .filter((p) => (typeF === 'all' || p.type === typeF) && (statusF === 'all' || displayStatus(p) === statusF) && matches(search, p.title, p.locality, p.city, p.referenceId, p.id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages);
  const pageRows = list.slice((cur - 1) * size, cur * size);
  const selIds = Object.keys(selected).filter((k) => selected[k] && list.some((p) => p.id === k));
  const selList = list.filter((p) => selIds.includes(p.id));
  const launchPassed = (p: Property) => p.isUpcoming && !!launchDay(p) && launchDay(p) < today;
  const open = (p: Property) => () => navigate('/admin/properties/' + p.id);
  const filtersActive = !!(search.trim() || typeF !== 'all' || statusF !== 'all');
  const clearFilters = () => {
    setSearch('');
    setTypeF('all');
    setStatusF('all');
  };

  const titleTab = tab === 'featured' ? 'Featured Properties' : tab === 'upcoming' ? 'Upcoming Properties' : 'Properties';
  let empty: { icon: string; title: string; text: string; action?: { label: string; onClick: () => void } } =
    tab === 'featured'
      ? { icon: 'star', title: 'No featured properties', text: 'Mark properties as featured from their detail page' }
      : tab === 'upcoming'
        ? { icon: 'clock', title: 'No upcoming properties', text: 'Mark properties as upcoming with a launch date to show them here' }
        : { icon: 'building', title: 'No properties yet', text: 'Add your first property or import the Master Sheet', action: { label: 'Add Property', onClick: () => navigate('/admin/properties/add') } };
  if (base.length && !list.length) empty = { icon: 'filter-x', title: 'No properties match your filters', text: 'Try a different search, type or status', action: { label: 'Clear filters', onClick: clearFilters } };
  const state = q.isPending ? 'loading' : q.isError ? 'error' : list.length === 0 ? 'empty' : 'normal';

  const confirmDelete = (ids: string[]) => {
    const props = items.filter((p) => ids.includes(p.id));
    const sold = props.some((p) => p.status === 'sold');
    const activity = props.some((p) => p.enquiries > 0 || p.visits > 0);
    const msg =
      (ids.length > 1 ? 'Properties will move to Deleted Properties and can be restored later.' : sold ? 'This is a sold property. Delete record anyway?' : 'This will move the property to Deleted Properties. You can restore it later.') +
      (activity ? '\n\nProperty has active deals (enquiries or visits on record).' : '');
    askConfirm({
      title: ids.length > 1 ? 'Delete ' + ids.length + ' properties?' : 'Delete property?',
      message: msg,
      confirmLabel: 'Delete',
      tone: 'destructive',
      onConfirm: async () => {
        await act.remove(ids);
        setSelected({});
      },
    });
  };

  const rows: Row[] = pageRows.map((p) => ({
    key: p.id,
    onClick: open(p),
    checked: !!selected[p.id],
    onCheck: () => setSelected((s) => ({ ...s, [p.id]: !s[p.id] })),
    cells: [
      {
        thumb: p.photos[0] || p.coverPhoto || '',
        title: p.title,
        strong: true,
        sub: p.referenceId,
        wrap: true,
        tags: [p.isFeatured ? badge('⭐ Featured', 'amber') : null, p.isUpcoming ? badge('🕐 Upcoming', 'purple') : null],
        flags: [launchPassed(p) ? { text: 'Launch passed', bg: '#fee2e2', fg: '#b91c1c' } : null],
      },
      { title: p.locality, sub: p.city },
      p.price ? { title: price(p.price), strong: true, sub: p.isNegotiable ? 'Negotiable' : '' } : { title: 'Price not set', muted: true },
      { title: typeLabel(p.type), sub: [bhkOf(p), areaOf(p) ? num(areaOf(p)) + ' sqft' : ''].filter(Boolean).join(' · ') },
      { badges: [stB(displayStatus(p))] },
      { badges: [isOnApp(p) ? badge('Live', 'green') : badge('Hidden', 'muted')] },
      { title: String(p.saves) },
      { title: String(p.compareCount) },
      { title: num(p.views) + ' views', sub: p.enquiries + ' enquiries', tags: [p.views > 1200 ? badge('🔥 Popular', 'orange') : null] },
      { title: tab === 'upcoming' ? (launchDay(p) ? date(launchDay(p) + 'T12:00:00') : 'Set date ⚠️') : date(p.createdAt), muted: true },
      {
        actions: [
          launchPassed(p) ? { label: 'Move to Available', variant: 'green', onClick: () => void act.moveToAvailable(p) } : null,
          { label: 'View →', onClick: open(p) },
          { icon: 'more-horizontal', title: 'More actions', onClick: () => setMenuId(p.id) },
        ],
      },
    ],
  }));

  const gridCols = vw >= 1536 ? 'repeat(4, minmax(0, 1fr))' : vw >= 1024 ? 'repeat(3, minmax(0, 1fr))' : vw >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
  const showGrid = view === 'grid' && state === 'normal';
  const mp = menuId ? items.find((p) => p.id === menuId) : null;
  const done = (fn: () => void) => () => {
    setMenuId(null);
    fn();
  };
  const setViewMode = (v: string) => {
    writeView('properties', v);
    setView(v);
  };

  return (
    <PageStack>
      <ListHeader
        title={titleTab}
        count={String(base.length)}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: 'Search title, locality, city…' }}
        selects={[
          { label: 'Type', value: typeF, onChange: (v) => { setTypeF(v); setPage(1); }, options: [{ value: 'all', label: 'All Types' }, ...FILTER_TYPES.map(([value, label]) => ({ value, label }))] },
          { label: 'Status', value: statusF, onChange: (v) => { setStatusF(v); setPage(1); }, options: [{ value: 'all', label: 'All Status' }, ...Object.entries(PROPERTY_STATUS).map(([value, [label]]) => ({ value, label }))] },
        ]}
        toggle={[
          { label: 'List view', icon: 'list', active: view === 'list', onClick: () => setViewMode('list') },
          { label: 'Grid view', icon: 'layout-grid', active: view === 'grid', onClick: () => setViewMode('grid') },
        ]}
        right={
          <>
            <button type="button" className={styles.iconBtn} title="Refresh" aria-label="Refresh" onClick={() => void q.refetch().then(() => toast('Refreshed'))}>
              <Icon name="refresh-cw" size={16} spin={q.isFetching} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Download"
              aria-label="Download"
              disabled={!list.length}
              onClick={() => {
                exportProperties(list, 'properties.xlsx');
                toast('📥 Downloading properties.xlsx');
              }}
            >
              <Icon name="download" size={16} />
            </button>
            <button type="button" className={styles.addBtn} onClick={() => navigate('/admin/properties/add')}>
              <Icon name="plus" size={16} />
              Add Property
            </button>
          </>
        }
      />
      {filtersActive && (
        <div className={styles.filterSummary}>
          <span>{'Showing ' + list.length + ' of ' + base.length}</span>
          <button type="button" className={styles.linkBtn} onClick={clearFilters}>Clear filters</button>
        </div>
      )}
      {selIds.length > 0 && (
        <div className={styles.bulk}>
          <span className={styles.bulkLabel}>{selIds.length + ' selected'}</span>
          <button
            type="button"
            className={styles.bulkBtn}
            disabled={act.busy}
            onClick={() => void act.bulk(selList, { isVisibleOnApp: false }, '⏸ ' + selIds.length + ' listings paused').then(() => setSelected({}))}
          >
            <Icon name="pause" size={14} />Pause
          </button>
          <button
            type="button"
            className={styles.bulkBtn}
            disabled={act.busy}
            onClick={() => void act.bulk(selList, { isFeatured: true, isUpcoming: false }, '⭐ ' + selIds.length + ' properties featured').then(() => setSelected({}))}
          >
            <Icon name="star" size={14} />Feature
          </button>
          <button
            type="button"
            className={styles.bulkBtn}
            onClick={() => {
              exportProperties(selList, 'properties-selected.xlsx');
              toast('📥 Exported ' + selIds.length + ' properties');
            }}
          >
            <Icon name="download" size={14} />Export
          </button>
          <button type="button" className={styles.bulkBtn} style={{ color: '#dc2626' }} disabled={act.busy} onClick={() => confirmDelete(selIds)}>
            <Icon name="trash-2" size={14} />Delete
          </button>
          <button type="button" className={styles.bulkClear} onClick={() => setSelected({})}>Clear selection</button>
        </div>
      )}
      {showGrid ? (
        <div className={styles.grid} style={{ gridTemplateColumns: gridCols }}>
          {pageRows.map((p) => {
            const st = PROPERTY_STATUS[displayStatus(p)] ?? [p.status, 'muted'];
            const sb = badge(st[0], st[1]);
            const photo = p.photos[0] || p.coverPhoto;
            return (
              <div key={p.id} className={styles.card} role="button" tabIndex={0} onClick={open(p)} onKeyDown={(e) => e.key === 'Enter' && open(p)()}>
                <div className={styles.cardMedia}>
                  {photo ? <img src={photo} alt="" /> : <div className={styles.cardNoPhoto}><Icon name="building-2" size={40} stroke={1.5} /></div>}
                  <div className={styles.cardTags}>
                    {[p.isFeatured ? badge('⭐ Featured', 'amber') : null, p.isUpcoming ? badge('🕐 Upcoming', 'purple') : null].filter(Boolean).map((t) => (
                      <span key={t!.text} className={styles.pill} style={{ background: t!.bg, color: t!.fg }}>{t!.text}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardMeta}>{p.referenceId + ' · ' + typeLabel(p.type)}</span>
                    <span className={styles.pill} style={{ background: sb.bg, color: sb.fg }}>{sb.text}</span>
                  </div>
                  <p className={styles.cardTitle}>{p.title}</p>
                  <p className={styles.cardPrice}>{p.price ? price(p.price) : 'Price not set'}</p>
                  <p className={styles.cardLoc}><Icon name="map-pin" size={12} />{[p.locality, p.city].filter(Boolean).join(', ')}</p>
                  <div className={styles.cardStats}>
                    <span>{'👁️ ' + num(p.views)}</span>
                    <span>{'💬 ' + p.enquiries}</span>
                    <span>{'❤️ ' + p.saves}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={['Property', 'Location', 'Price', 'Type & Specs', 'Status', 'On App', 'Saves', 'Comparisons', 'Performance', tab === 'upcoming' ? 'Launch' : 'Added', 'Actions']}
          rows={rows}
          state={state}
          empty={empty}
          onRetry={() => void q.refetch()}
          errorTitle="Could not load properties"
          minWidth="1500px"
          selectable
          allChecked={pageRows.length > 0 && pageRows.every((p) => selected[p.id])}
          onToggleAll={() =>
            setSelected((s) => {
              const all = pageRows.every((p) => s[p.id]);
              const n = { ...s };
              pageRows.forEach((p) => (n[p.id] = !all));
              return n;
            })
          }
          footer={'Showing ' + (list.length ? (cur - 1) * size + 1 : 0) + '–' + Math.min(cur * size, list.length) + ' of ' + list.length + (q.data?.truncated ? ' (first ' + items.length + ' of ' + q.data.total + ' loaded)' : '')}
          pager={{ page: cur, pages, size, sizes: [10, 25, 50], label: cur + ' / ' + pages, setSize: (n) => { setSize(n); setPage(1); }, prev: () => setPage(Math.max(1, cur - 1)), next: () => setPage(Math.min(pages, cur + 1)) }}
        />
      )}
      {showGrid && (
        <div className={styles.filterSummary} style={{ justifyContent: 'space-between' }}>
          <span>{'Showing ' + ((cur - 1) * size + 1) + '–' + Math.min(cur * size, list.length) + ' of ' + list.length}</span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className={styles.smBtn} disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><Icon name="chevron-left" size={14} /></button>
            {cur + ' / ' + pages}
            <button type="button" className={styles.smBtn} disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><Icon name="chevron-right" size={14} /></button>
          </span>
        </div>
      )}
      {tab === 'all' && deleted.length > 0 && state !== 'loading' && state !== 'error' && (
        <div className={styles.deleted}>
          <button type="button" className={styles.deletedHead} onClick={() => setDelOpen((o) => !o)} aria-expanded={delOpen}>
            <span className={styles.deletedLabel}><Icon name="trash-2" size={16} />{'Deleted Properties (' + deleted.length + ')'}</span>
            <Icon name={delOpen ? 'chevron-up' : 'chevron-down'} size={16} />
          </button>
          {delOpen && (
            <div className={styles.deletedList}>
              {deleted.map((p) => (
                <div key={p.id} className={styles.deletedRow}>
                  <div>
                    <p className={styles.deletedTitle}>{p.title}</p>
                    <p className={styles.deletedSub}>{p.referenceId + ' · Deleted ' + relativeLong(p.deletedAt)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className={styles.smBtn} disabled={act.busy} onClick={() => void act.restore(p)}>Restore</button>
                    <button
                      type="button"
                      className={styles.smDanger}
                      disabled={act.busy}
                      onClick={() =>
                        askConfirm({
                          title: 'Permanently delete?',
                          message: p.title + ' will be removed forever. This cannot be undone.',
                          confirmLabel: 'Permanent Delete',
                          tone: 'destructive',
                          onConfirm: () => act.purge(p),
                        })
                      }
                    >
                      Permanent Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {mp && (
        <div className={styles.menuOverlay} onClick={() => setMenuId(null)}>
          <div className={styles.menu} role="menu" onClick={(e) => e.stopPropagation()}>
            <p className={styles.menuTitle}>{mp.title}</p>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={done(() => navigate('/admin/properties/' + mp.id))}>
              <Icon name="pencil" size={16} />Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={done(() => {
                if (!mp.isFeatured && mp.isUpcoming) return toast('Cannot be both Featured and Upcoming');
                void act.patch(mp, { isFeatured: !mp.isFeatured }, mp.isFeatured ? 'Removed from Featured' : '⭐ Marked as Featured');
              })}
            >
              <Icon name="star" size={16} />{mp.isFeatured ? 'Remove from Featured' : 'Mark as Featured'}
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={done(() => {
                if (!mp.isUpcoming && mp.isFeatured) return toast('Cannot be both Featured and Upcoming');
                void act.patch(
                  mp,
                  mp.isUpcoming ? { isUpcoming: false } : { isUpcoming: true, launchDate: launchDay(mp) || addDaysIso(today, 30) },
                  mp.isUpcoming ? 'Removed from Upcoming' : '🕐 Marked as Upcoming',
                );
              })}
            >
              <Icon name="clock" size={16} />{mp.isUpcoming ? 'Remove from Upcoming' : 'Mark as Upcoming'}
            </button>
            {displayStatus(mp) === 'paused' || mp.status === 'draft' ? (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={done(() => void act.publish(mp))}>
                <Icon name="play" size={16} />Publish
              </button>
            ) : (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={done(() => void act.pause(mp))}>
                <Icon name="pause" size={16} />Pause Listing
              </button>
            )}
            {mp.status !== 'sold' && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={done(() => askConfirm({ title: 'Mark as sold?', message: 'The listing will be removed from the app.', confirmLabel: 'Mark as Sold', onConfirm: () => act.markSold(mp) }))}
              >
                <Icon name="check-circle" size={16} />Mark as Sold
              </button>
            )}
            <button type="button" role="menuitem" className={styles.menuItem} style={{ color: '#dc2626' }} onClick={done(() => confirmDelete([mp.id]))}>
              <Icon name="trash-2" size={16} />Delete Property
            </button>
          </div>
        </div>
      )}
    </PageStack>
  );
}
