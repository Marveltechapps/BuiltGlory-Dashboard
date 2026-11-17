import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataTable, type Cell, type Row } from '../../../components/tables/DataTable';
import { readView, writeView } from '../../../components/tables/listState';
import { Icon } from '../../../components/ui/Icon';
import { ListHeader, PageStack } from '../../../components/ui/ListHeader';
import { TONE } from '../../../constants/labels';
import { ACQ_TAB, PRIORITY_RANK, SALES_TAB, STAGE_DOT } from '../../../constants/pipeline';
import { useSalesTeam } from '../../../hooks/useTeam';
import { useViewport } from '../../../hooks/useViewport';
import { acqStage, badge, initials, price, relative, relativeLong, salesStage, shortId, typeLabel } from '../../../lib/format';
import { listAcquisitions } from '../../../services/acquisitions';
import { listSalesDeals } from '../../../services/sales';
import styles from '../components/Pipeline.module.css';

interface PipeItem {
  id: string;
  ref: string;
  stage: string;
  priority: string;
  person: string;
  personSub: string;
  title: string;
  type: string;
  photo: string;
  priceMain: number;
  figs: Array<{ label: string; value: string; color: string }>;
  agreedSub: string;
  location: string;
  days: number;
  assignedTo: string | null;
  assignedName: string | null;
  lastActivityAt: string;
  hold: string;
  lost: string;
}

const pri = (p: string) => (p === 'urgent' ? badge('Urgent', 'red') : p === 'high' ? badge('High', 'orange') : null);

/** Acquisition / Sales pipeline: grid of stage cards or table, one route per stage tab. */
export function PipelinePage({ kind }: { kind: 'acquisition' | 'sales' }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { vw } = useViewport();
  const isSales = kind === 'sales';
  const seg = pathname.split('/').pop() || 'all';
  const stage = (isSales ? SALES_TAB : ACQ_TAB)[seg] ?? null;
  const stageLabel = stage ? (isSales ? salesStage(stage) : acqStage(stage)) : '';
  const [search, setSearch] = useState('');
  const [view, setView] = useState(() => readView(kind, 'grid'));
  const { nameOf } = useSalesTeam();
  const acqQ = useQuery({ queryKey: ['acquisitions'], queryFn: ({ signal }) => listAcquisitions(signal), enabled: !isSales });
  const salesQ = useQuery({ queryKey: ['sales-deals'], queryFn: ({ signal }) => listSalesDeals(signal), enabled: isSales });
  const q = isSales ? salesQ : acqQ;

  const items: PipeItem[] = isSales
    ? (salesQ.data?.items ?? []).map((d) => ({
        id: d.id,
        ref: shortId(d.id, d.referenceId),
        stage: d.stage,
        priority: d.priority,
        person: d.buyerName,
        personSub: d.buyerPhone,
        title: d.propertyTitle,
        type: d.propertyType,
        photo: d.photos[0] || '',
        priceMain: d.listedPrice,
        figs: [
          { label: 'Price', value: price(d.listedPrice), color: '#0f172a' },
          { label: 'Offer', value: d.offeredPrice ? price(d.offeredPrice) : '—', color: '#0f172a' },
          { label: 'Agreed', value: d.agreedPrice ? price(d.agreedPrice) : 'No offer recorded yet', color: d.agreedPrice ? '#15803d' : '#94a3b8' },
        ],
        agreedSub: d.agreedPrice ? 'Agreed ' + price(d.agreedPrice) : 'No offer recorded yet',
        location: d.propertyLocation,
        days: d.daysInStage,
        assignedTo: d.assignedTo,
        assignedName: d.assignedName,
        lastActivityAt: d.lastActivityAt,
        hold: '',
        lost: d.stage === 'lost' ? d.lostReason || 'No reason recorded' : '',
      }))
    : (acqQ.data?.items ?? []).map((a) => ({
        id: a.id,
        ref: shortId(a.id, a.referenceId),
        stage: a.stage,
        priority: a.priority,
        person: a.sellerName,
        personSub: a.sellerPhone,
        title: a.title,
        type: a.type,
        photo: a.photos[0] || '',
        priceMain: a.askingPrice,
        figs: [
          { label: 'Asking Price', value: price(a.askingPrice), color: '#0f172a' },
          { label: 'Builtglory Offer', value: a.builtgloryOffer ? price(a.builtgloryOffer) : '—', color: '#15803d' },
          { label: 'Agreed', value: a.agreedPrice ? price(a.agreedPrice) : '—', color: '#15803d' },
        ],
        agreedSub: '',
        location: a.location,
        days: a.daysInStage,
        assignedTo: a.assignedTo,
        assignedName: a.assignedName,
        lastActivityAt: a.lastActivityAt,
        hold: a.stage === 'on_hold' ? a.onHoldReason || 'No reason recorded' : '',
        lost: '',
      }));

  const all = items.filter((r) => !stage || r.stage === stage);
  const s = search.trim().toLowerCase();
  const list = all
    .filter((r) => !s || [r.person, r.title, r.ref, r.location].some((v) => String(v || '').toLowerCase().includes(s)))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || b.days - a.days);
  const terminal = isSales ? ['closed', 'lost'] : ['acquired', 'rejected'];
  const dot = (st: string) => STAGE_DOT[kind][st] || '#94a3b8';
  const label = (st: string) => (isSales ? salesStage(st) : acqStage(st));
  const open = (r: PipeItem) => () => navigate((isSales ? '/admin/sales/' : '/admin/acquisition/') + r.id);
  const assignee = (r: PipeItem) => nameOf(r.assignedTo, r.assignedName) || r.assignedName;
  const setViewMode = (v: string) => {
    writeView(kind, v);
    setView(v);
  };

  const emptyCfg = isSales
    ? { icon: 'trending-up', title: stage ? 'No ' + stageLabel + ' deals' : 'No sales deals yet', text: stage ? 'Deals in this stage will appear here' : 'Deals created from buy enquiries and chats appear here', action: { label: 'View buy enquiries', onClick: () => navigate('/admin/enquiries/buy') } }
    : { icon: 'building-2', title: stage ? 'No ' + stageLabel + ' properties' : 'No acquisitions yet', text: stage ? 'Properties in this stage will appear here' : 'Accepted sell requests and submitted listings will appear here automatically.' };
  const empty = s && all.length && !list.length ? { icon: 'search-x', title: 'No results found', text: 'Try a different search term', action: { label: 'Clear search', onClick: () => setSearch('') } } : emptyCfg;
  const tableState = q.isPending ? 'loading' : list.length === 0 ? 'empty' : 'normal';
  const gridMode = view === 'grid';

  const stageCell = (r: PipeItem): Cell => ({ dot: dot(r.stage), title: label(r.stage), sub: r.days + 'd in stage', flags: [r.days > 14 && !terminal.includes(r.stage) ? { text: '⚠️ Stalled' } : null] });
  const assignCell = (r: PipeItem): Cell => (assignee(r) ? { title: assignee(r) } : { title: '⚠️ Unassigned', color: '#c2410c' });
  const rows: Row[] = list.map((r) => {
    const act: Cell = { actions: [{ label: r.stage === 'on_hold' ? 'Resume →' : 'View →', onClick: open(r) }] };
    return {
      key: r.id,
      onClick: open(r),
      dim: r.stage === 'rejected' || r.stage === 'lost',
      cells: isSales
        ? [
            { initials: initials(r.person), title: r.person, strong: true, sub: r.ref },
            { thumb: r.photo, title: r.title, sub: r.location, wrap: true },
            { title: price(r.priceMain), strong: true, sub: r.agreedSub },
            stageCell(r),
            { badges: [pri(r.priority) || badge('Normal', 'muted')] },
            assignCell(r),
            { title: relativeLong(r.lastActivityAt), muted: true },
            act,
          ]
        : [
            { thumb: r.photo, title: r.title, strong: true, sub: r.ref + ' · ' + price(r.priceMain), wrap: true },
            { initials: initials(r.person), title: r.person, sub: r.personSub },
            stageCell(r),
            { badges: [pri(r.priority) || badge('Normal', 'muted')] },
            assignCell(r),
            { title: relativeLong(r.lastActivityAt), muted: true },
            act,
          ],
    };
  });
  const gridCols = vw >= 1536 ? 'repeat(4, minmax(0, 1fr))' : vw >= 1280 ? 'repeat(3, minmax(0, 1fr))' : vw >= 768 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';

  return (
    <PageStack>
      <ListHeader
        title={isSales ? 'Sales Pipeline' : 'Acquisition Pipeline'}
        count={String(all.length)}
        search={{ value: search, onChange: setSearch, placeholder: isSales ? 'Search buyers, properties…' : 'Search properties, sellers…' }}
        toggle={[
          { label: 'Grid view', icon: 'layout-grid', active: view === 'grid', onClick: () => setViewMode('grid') },
          { label: 'List view', icon: 'list', active: view === 'list', onClick: () => setViewMode('list') },
        ]}
        titleExtra={stage ? <span className={styles.stagePill}><span style={{ width: 8, height: 8, borderRadius: 9999, background: dot(stage) }} />{stageLabel}</span> : null}
      />
      {q.isError && (
        <div className={styles.errorBanner}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="alert-circle" size={16} />{isSales ? 'Could not load sales deals.' : 'Could not load acquisitions.'}</span>
          <button type="button" className={styles.errorBtn} onClick={() => void q.refetch()}>Retry</button>
        </div>
      )}
      {!q.isError && gridMode && tableState === 'normal' && (
        <div className={styles.grid} style={{ gridTemplateColumns: gridCols }}>
          {list.map((r) => {
            const tone = r.days > 14 ? TONE.red! : r.days >= 7 ? TONE.amber! : TONE.green!;
            const p = pri(r.priority);
            const a = assignee(r);
            return (
              <div key={r.id} className={styles.card} style={{ opacity: r.stage === 'rejected' ? 0.75 : 1 }} onClick={open(r)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(r)()}>
                <div className={styles.media}>
                  {r.photo ? <img className={styles.photo} src={r.photo} alt="" /> : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><Icon name="building-2" size={40} stroke={1.5} /></div>}
                  <div className={styles.shade} />
                  <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', gap: 6 }}>
                    {p && <span className={styles.pill} style={{ background: p.bg, color: p.fg }}>{p.text}</span>}
                    <span className={styles.pill} style={{ background: 'rgba(255,255,255,0.9)', color: '#334155' }}>{typeLabel(r.type)}</span>
                  </div>
                  <div className={styles.stageChip}><span style={{ width: 8, height: 8, borderRadius: 9999, background: dot(r.stage) }} />{label(r.stage)}</div>
                </div>
                <div className={styles.body}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={styles.avatar}>{initials(r.person)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className={styles.ellipsis} style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>{r.person}</p>
                      <p style={{ fontSize: 12, lineHeight: '16px', color: '#64748b' }}>{r.ref}</p>
                    </div>
                    <span style={{ flexShrink: 0, borderRadius: 9999, background: '#f1f5f9', padding: '2px 8px', fontSize: 11, lineHeight: '16px', color: '#64748b' }}>{relative(r.lastActivityAt)}</span>
                  </div>
                  <div>
                    <p className={styles.title2}>{r.title}</p>
                    <p style={{ marginTop: 4, fontSize: 20, lineHeight: '28px', fontWeight: 700, color: '#2563eb' }}>{price(r.priceMain)}</p>
                  </div>
                  <div className={styles.figs}>
                    {r.figs.map((fg) => (
                      <div key={fg.label} style={{ minWidth: 0 }}>
                        <p className={styles.figLbl}>{fg.label}</p>
                        <p className={styles.ellipsis} style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: fg.color }}>{fg.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className={styles.pill} style={{ background: tone[0], color: tone[1] }}>{r.days}d in stage</span>
                    {r.days > 14 && !terminal.includes(r.stage) && <span className={styles.pill} style={{ background: '#ffedd5', color: '#c2410c' }}>⚠️ Stalled</span>}
                  </div>
                  {r.hold && <p style={{ borderRadius: 12, border: '1px solid #fde68a', background: '#fffbeb', padding: '8px 10px', fontSize: 12, lineHeight: '16px', color: '#92400e' }}>Hold reason: {r.hold}</p>}
                  {r.lost && <p style={{ borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', padding: '8px 10px', fontSize: 12, lineHeight: '16px', color: '#991b1b' }}>Lost reason: {r.lost}</p>}
                  <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, lineHeight: '16px', color: '#64748b' }}><Icon name="map-pin" size={12} />{r.location || '—'}</p>
                  <div className={styles.foot}>
                    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'flex', width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#f1f5f9', fontSize: 10, fontWeight: 600, color: '#475569' }}>{a ? initials(a) : '?'}</span>
                      <span className={styles.ellipsis} style={{ fontSize: 12, lineHeight: '16px', color: a ? '#334155' : '#c2410c' }}>{a || '⚠️ Unassigned'}</span>
                    </div>
                    <span className={styles.cta}>{r.stage === 'on_hold' ? 'Resume →' : 'View Details →'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!q.isError && (!gridMode || tableState !== 'normal') && (
        <DataTable
          columns={isSales ? ['Buyer', 'Property', 'Price', 'Stage', 'Priority', 'Assigned', 'Last Activity', 'Actions'] : ['Property', 'Seller', 'Stage', 'Priority', 'Assigned', 'Last Activity', 'Actions']}
          rows={rows}
          state={tableState}
          empty={empty}
          onRetry={() => void q.refetch()}
          errorTitle="Could not load pipeline"
          minWidth={isSales ? '1120px' : '1040px'}
        />
      )}
    </PageStack>
  );
}
