import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReportChart } from '../../../components/charts/ReportChart';
import { DataTable, type Row, type TableState } from '../../../components/tables/DataTable';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useSession } from '../../../hooks/useSession';
import { useViewport } from '../../../hooks/useViewport';
import { formatApiError, saveBlob } from '../../../lib/apiClient';
import { acqStage, badge, date, dateTime, initials, price, relativeLong, salesStage, statusLabel, typeLabel } from '../../../lib/format';
import { listAcquisitions } from '../../../services/acquisitions';
import { listSellRequests } from '../../../services/enquiries';
import { countRecords, createReportExport, createReportSchedule, downloadReportExport, getAcquisitionAnalytics, getRevenueAnalytics, getSalesAnalytics, listReportExports, listReportSchedules, type CountPath } from '../../../services/reports';
import { listSalesDeals } from '../../../services/sales';
import { toast } from '../../../store/uiStore';
import type { ExportFormat, ExportReportType, ReportExport, ScheduleFrequency, ScheduleReportType } from '../../../types/reports';
import styles from './Reports.module.css';

type Tab = 'sales' | 'acquisition' | 'revenue' | 'export';
type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom';

const TYPE_OPTS = ['All Types', 'Plot', 'Apartment', 'Residential', 'Commercial', 'Villa', 'Other'];
const MAIN_TYPES: Record<string, string> = { Plot: 'plot', Apartment: 'apartment', Residential: 'residential', Commercial: 'commercial', Villa: 'villa' };
const ACTIVE_STAGES = ['active_leads', 'site_visits', 'negotiation', 'token_payment', 'full_payment', 'stage_payment', 'interior_design', 'documentation', 're_engagement'];
const D = 864e5;
const SUBTITLES: Record<'sales' | 'acquisition' | 'revenue', string> = {
  sales: 'Deal flow, pipeline value and closed revenue',
  acquisition: 'Sourcing funnel, acquisition cost and inventory',
  revenue: 'Collections against acquisition cost',
};

const ymd = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function rangeOf(period: Period, from: string, to: string) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (period === 'month') d.setDate(1);
  if (period === 'quarter') d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  if (period === 'year') d.setMonth(0, 1);
  if (period === 'custom') return { from: from || undefined, to: to || undefined };
  return { from: ymd(d), to: ymd(new Date()) };
}
const monthLabel = (m: string) => {
  const t = Date.parse(/^\d{4}-\d{2}$/.test(m) ? m + '-01T12:00:00' : m);
  return isNaN(t) ? m : new Date(t).toLocaleDateString('en-IN', { month: 'short' });
};
const short = (v: number) => (v >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr' : v >= 1e5 ? Math.round(v / 1e5) + 'L' : String(Math.round(v)));
const count = (v: number) => String(Math.round(v * 10) / 10);
const emptyOf = (title: string, text = '') => ({ icon: 'inbox', title, text });

interface Kpi {
  label: string;
  value: string;
  sub: string;
  color: string;
}

interface TableSpec {
  title: string;
  note?: string;
  columns: string[];
  rows: Row[];
  state: TableState;
  empty: { icon: string; title: string; text: string };
  minWidth: string;
}

export function ReportsPage() {
  const { pathname } = useLocation();
  const tab = (['sales', 'acquisition', 'revenue', 'export'].find((t) => pathname.endsWith('/' + t)) || 'sales') as Tab;
  return tab === 'export' ? <ExportView /> : <AnalyticsView key={tab} tab={tab} />;
}

function KpiGrid({ kpis, cols }: { kpis: Kpi[]; cols: string }) {
  return (
    <div className={styles.grid} style={{ gridTemplateColumns: cols }}>
      {kpis.map((k) => (
        <div key={k.label} className={styles.kpi}>
          <div className={styles.kpiBar} />
          <p className={styles.kpiLabel}>{k.label}</p>
          <p className={styles.kpiValue} style={{ color: k.color }}>{k.value}</p>
          <p className={styles.kpiSub}>{k.sub}</p>
        </div>
      ))}
    </div>
  );
}

function StateCard({ kind, onRetry }: { kind: 'error' | 'empty'; onRetry?: () => void }) {
  return (
    <div className={styles.stateCard}>
      {kind === 'error' ? (
        <>
          <span style={{ display: 'inline-flex', color: 'rgba(220,38,38,0.7)' }}><Icon name="alert-circle" size={48} /></span>
          <p className={styles.stateTitle} style={{ marginTop: 12 }}>Unable to load reports</p>
          <button type="button" className={styles.retry} onClick={onRetry}>Retry</button>
        </>
      ) : (
        <>
          <span style={{ display: 'inline-flex', color: 'rgba(100,116,139,0.4)' }}><Icon name="bar-chart-2" size={64} stroke={1.5} /></span>
          <p className={styles.stateTitle} style={{ marginTop: 16 }}>No data for selected period</p>
          <p className={styles.muted}>Try a different date range</p>
        </>
      )}
    </div>
  );
}

function Header({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className={styles.head}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.muted}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function AnalyticsView({ tab }: { tab: Exclude<Tab, 'export'> }) {
  const navigate = useNavigate();
  const { vw } = useViewport();
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [typeF, setTypeF] = useState('All Types');
  const range = rangeOf(period, from, to);
  const propertyType = MAIN_TYPES[typeF];
  const query = { ...range, ...(propertyType ? { propertyType } : {}) };
  const typeOk = (t: string) => typeF === 'All Types' || (typeF === 'Other' ? !Object.values(MAIN_TYPES).includes(t) : MAIN_TYPES[typeF] === t);
  const inRange = (v: string | null | undefined) => {
    if (!v) return false;
    const t = Date.parse(v);
    return (!range.from || t >= Date.parse(range.from + 'T00:00:00')) && (!range.to || t <= Date.parse(range.to + 'T23:59:59'));
  };

  const salesQ = useQuery({ queryKey: ['report', 'sales', query], queryFn: ({ signal }) => getSalesAnalytics(query, signal), enabled: tab === 'sales' });
  const acqQ = useQuery({ queryKey: ['report', 'acquisition', query], queryFn: ({ signal }) => getAcquisitionAnalytics(query, signal), enabled: tab === 'acquisition' });
  const revQ = useQuery({ queryKey: ['report', 'revenue', query], queryFn: ({ signal }) => getRevenueAnalytics(query, signal), enabled: tab === 'revenue' });
  const dealsQ = useQuery({ queryKey: ['sales-deals'], queryFn: ({ signal }) => listSalesDeals(signal), enabled: tab === 'sales' });
  const acqListQ = useQuery({ queryKey: ['acquisitions'], queryFn: ({ signal }) => listAcquisitions(signal), enabled: tab === 'acquisition' });
  const sellQ = useQuery({ queryKey: ['sell-requests'], queryFn: ({ signal }) => listSellRequests(signal), enabled: tab === 'acquisition' });
  const q = tab === 'sales' ? salesQ : tab === 'acquisition' ? acqQ : revQ;

  const title = 'Reports';
  const subtitle = SUBTITLES[tab];
  let kpis: Kpi[] = [];
  let charts: ReactNode[] = [];
  let tables: TableSpec[] = [];
  let hasData = false;
  const listState = (lq: { isPending: boolean; isError: boolean }, n: number): TableState => (lq.isPending ? 'loading' : lq.isError ? 'error' : n ? 'normal' : 'empty');

  if (tab === 'sales' && salesQ.data) {
    const a = salesQ.data;
    const deals = (dealsQ.data?.items ?? []).filter((d) => typeOk(d.propertyType));
    const active = deals.filter((d) => ACTIVE_STAGES.includes(d.stage));
    const closedP = deals.filter((d) => d.stage === 'closed' && inRange(d.closedAt));
    const negotiation = a.pipelineByStage.find((s) => s.stage === 'negotiation')?.count ?? active.filter((d) => d.stage === 'negotiation').length;
    const months = (a.monthlyDealActivity.length ? a.monthlyDealActivity.map((m) => m.month) : a.monthlyClosedDeals.map((m) => m.month));
    const compared = a.propertyComparison.slice().sort((x, y) => y.compareCount - x.compareCount).slice(0, 6);
    kpis = [
      { label: 'Active Deals', value: String(a.stats.pipelineCount ?? active.length), sub: negotiation + ' in negotiation', color: '#0f172a' },
      { label: 'Pipeline Value', value: price(a.stats.pipelineValue ?? active.reduce((t, d) => t + (d.agreedPrice || d.listedPrice), 0)), sub: 'Agreed or listed price of open deals', color: '#0f172a' },
      { label: 'Deals Closed', value: String(a.stats.count), sub: 'In selected period', color: '#15803d' },
      { label: 'Closed Revenue', value: price(a.stats.revenue), sub: 'Agreed value of closed deals', color: '#7e22ce' },
    ];
    charts = [
      <ReportChart
        key="activity"
        kind="bar"
        title="Deal Activity by Month"
        categories={months.map(monthLabel)}
        series={[
          { name: 'Created', color: '#3b82f6', values: months.map((m) => a.monthlyDealActivity.find((x) => x.month === m)?.deals ?? 0) },
          { name: 'Closed', color: '#22c55e', values: months.map((m) => a.monthlyClosedDeals.find((x) => x.month === m)?.deals ?? 0) },
        ]}
        format={count}
      />,
      <ReportChart key="type" kind="donut" title="Revenue by Property Type" items={a.revenueByType.map((r) => ({ label: typeLabel(r.type) || 'Other', value: r.revenue })).sort((x, y) => y.value - x.value)} format={price} />,
    ];
    tables = [
      {
        title: 'Most Compared Properties',
        note: 'Comparison analytics from app (B-15)',
        columns: ['Property', 'Compare Count', 'Enquiry Rate', 'Conversion', 'Actions'],
        minWidth: '760px',
        state: compared.length ? 'normal' : 'empty',
        empty: emptyOf('No comparison data available'),
        rows: compared.map((p) => ({
          key: p.id,
          onClick: () => navigate('/admin/properties/' + p.id),
          cells: [
            { thumb: p.photo, title: p.title, strong: true, sub: [p.locality, p.city].filter(Boolean).join(', ') },
            { title: String(p.compareCount), strong: true },
            { title: (p.views ? ((p.enquiries / p.views) * 100).toFixed(1) : '0.0') + '%' },
            { title: (p.enquiries ? ((p.visits / p.enquiries) * 100).toFixed(0) : '0') + '%' },
            { actions: [{ label: 'View →', onClick: () => navigate('/admin/properties/' + p.id) }] },
          ],
        })),
      },
      {
        title: 'Active Deals',
        columns: ['Buyer', 'Property', 'Stage', 'Agreed Price', 'Last Activity', 'Actions'],
        minWidth: '900px',
        state: listState(dealsQ, active.length),
        empty: emptyOf('No active deals'),
        rows: active.slice(0, 10).map((d) => ({
          key: d.id,
          onClick: () => navigate('/admin/sales/' + d.id),
          cells: [
            { initials: initials(d.buyerName), title: d.buyerName, strong: true },
            { title: d.propertyTitle, wrap: true },
            { badges: [badge(salesStage(d.stage), 'blue')] },
            { title: d.agreedPrice ? price(d.agreedPrice) : '—' },
            { title: relativeLong(d.lastActivityAt), muted: true },
            { actions: [{ label: 'View Deal →', onClick: () => navigate('/admin/sales/' + d.id) }] },
          ],
        })),
      },
      {
        title: 'Closed Deals',
        columns: ['Buyer', 'Property', 'Type', 'Agreed Price', 'Closed Date', 'Payment Type'],
        minWidth: '860px',
        state: listState(dealsQ, closedP.length),
        empty: emptyOf('No deals closed in this period', 'Try a different date range'),
        rows: closedP.map((d) => ({
          key: d.id,
          onClick: () => navigate('/admin/sales/' + d.id),
          cells: [
            { initials: initials(d.buyerName), title: d.buyerName, strong: true },
            { title: d.propertyTitle, wrap: true },
            { title: typeLabel(d.propertyType) },
            { title: price(d.agreedPrice || 0), strong: true },
            { title: date(d.closedAt), muted: true },
            { badges: [badge(d.paymentType === 'stage' ? 'Stage Payment' : 'Full Payment', d.paymentType === 'stage' ? 'teal' : 'green')] },
          ],
        })),
      },
    ];
    hasData = a.stats.count > 0 || (a.stats.pipelineCount ?? active.length) > 0 || a.monthlyDealActivity.some((m) => m.deals > 0) || compared.length > 0 || deals.length > 0;
  }

  if (tab === 'acquisition' && acqQ.data) {
    const a = acqQ.data;
    const acqs = (acqListQ.data?.items ?? []).filter((x) => typeOk(x.type));
    const acquired = acqs.filter((x) => x.stage === 'acquired');
    const active = acqs.filter((x) => !['acquired', 'rejected'].includes(x.stage));
    const incoming = (sellQ.data?.items ?? []).filter((r) => typeOk(r.type) && ['new', 'under_review'].includes(r.status));
    const byType = a.acquisitionByType.filter((t) => t.count > 0);
    const dIn = (stageEnteredAt: string) => Math.max(0, Math.floor((Date.now() - Date.parse(stageEnteredAt)) / D));
    kpis = [
      { label: 'Total Acquired', value: String(a.stats.count), sub: 'Owned by Builtglory', color: '#15803d' },
      { label: 'Total Acquisition Cost', value: price(a.stats.cost), sub: 'Agreed price of acquired properties', color: '#0f172a' },
      { label: 'Avg Acquisition Price', value: price(a.stats.averageCost), sub: 'Per acquired property', color: '#0f172a' },
      { label: 'Pipeline Active', value: String(a.stats.pipelineActive), sub: (a.stageCounts.find((s) => s.stage === 'negotiation')?.count ?? 0) + ' in negotiation', color: '#2563eb' },
      { label: 'Incoming Sell Requests', value: String(a.stats.incomingSellRequests ?? incoming.length), sub: 'New + under review', color: '#c2410c' },
    ];
    charts = [<ReportChart key="type" kind="bar" title="By Property Type" categories={byType.map((t) => typeLabel(t.type) || 'Other')} series={[{ name: 'Acquisitions', color: '#8b5cf6', values: byType.map((t) => t.count) }]} format={count} />];
    tables = [
      {
        title: 'Incoming Sell Requests',
        columns: ['Seller', 'Property', 'Status', 'Asking Price', 'Location'],
        minWidth: '820px',
        state: listState(sellQ, incoming.length),
        empty: emptyOf('No incoming sell requests'),
        rows: incoming.map((r) => ({
          key: r.id,
          onClick: () => navigate('/admin/enquiries/sell/' + r.id),
          cells: [
            { initials: initials(r.sellerName), title: r.sellerName, strong: true },
            { title: r.title, wrap: true },
            { badges: [badge(statusLabel(r.status), r.status === 'new' ? 'blue' : 'amber')] },
            { title: price(r.askingPrice) },
            { title: [r.locality, r.city].filter(Boolean).join(', '), muted: true },
          ],
        })),
      },
      {
        title: 'Active Acquisitions',
        columns: ['Property', 'Seller', 'Stage', 'Asking Price', 'BG Offer', 'Days in Stage'],
        minWidth: '900px',
        state: listState(acqListQ, active.length),
        empty: emptyOf('No active acquisitions'),
        rows: active.map((x) => {
          const days = dIn(x.stageEnteredAt);
          return {
            key: x.id,
            onClick: () => navigate('/admin/acquisition/' + x.id),
            cells: [
              { title: x.title, strong: true, sub: x.referenceId },
              { title: x.sellerName },
              { badges: [badge(acqStage(x.stage), x.stage === 'on_hold' ? 'slate' : 'blue')] },
              { title: price(x.askingPrice) },
              { title: x.builtgloryOffer ? price(x.builtgloryOffer) : '—', color: x.builtgloryOffer ? '#15803d' : undefined },
              { title: days + 'd', color: days > 14 ? '#c2410c' : undefined, strong: days > 14 },
            ],
          };
        }),
      },
      {
        title: 'Acquired Properties',
        columns: ['Property', 'Final Price', 'Acquired Date', 'Listed'],
        minWidth: '720px',
        state: listState(acqListQ, acquired.length),
        empty: emptyOf('No acquired properties'),
        rows: acquired.map((x) => ({
          key: x.id,
          onClick: () => navigate('/admin/acquisition/' + x.id),
          cells: [
            { title: x.title, strong: true, sub: [x.location, x.city].filter(Boolean).join(', ') },
            { title: price(x.finalPurchasePrice || x.agreedPrice || 0), strong: true },
            { title: date(x.stageEnteredAt), muted: true },
            { badges: [x.propertyId ? badge('Yes', 'green') : badge('No', 'muted')] },
          ],
        })),
      },
    ];
    hasData = a.stats.count > 0 || a.stats.pipelineActive > 0 || byType.length > 0 || acqs.length > 0 || incoming.length > 0;
  }

  if (tab === 'revenue' && revQ.data) {
    const a = revQ.data;
    const months = a.revenueVsCost.map((m) => m.month);
    const trendMonths = a.profitTrend.length ? a.profitTrend.map((m) => m.month) : months;
    kpis = [
      { label: 'Total Revenue', value: price(a.stats.revenue), sub: 'Verified payments received', color: '#0f172a' },
      { label: 'Gross Profit', value: price(Math.max(0, a.stats.profit)), sub: 'Revenue minus attributed acquisition cost', color: '#15803d' },
      { label: 'Profit Margin', value: Math.max(0, a.stats.margin).toFixed(1) + '%', sub: 'Gross profit ÷ revenue', color: '#7e22ce' },
    ];
    charts = [
      <ReportChart
        key="rc"
        kind="bar"
        title="Revenue vs Acquisition Cost"
        categories={months.map(monthLabel)}
        series={[
          { name: 'Revenue', color: '#3b82f6', values: a.revenueVsCost.map((m) => m.revenue) },
          { name: 'Acquisition Cost', color: '#f59e0b', values: a.revenueVsCost.map((m) => m.cost) },
        ]}
        format={short}
      />,
      <ReportChart key="pt" kind="line" title="Monthly Profit Trend" categories={trendMonths.map(monthLabel)} series={[{ name: 'Profit', color: '#22c55e', values: a.profitTrend.map((m) => Math.max(0, m.profit)) }]} format={short} />,
    ];
    tables = [
      {
        title: 'Pending Payments',
        columns: ['Buyer', 'Property', 'Deal Value', 'Paid So Far', 'Balance Due'],
        minWidth: '820px',
        state: a.pendingPayments.length ? 'normal' : 'empty',
        empty: emptyOf('No pending payments'),
        rows: a.pendingPayments.map((p) => ({
          key: p.id,
          onClick: p.id ? () => navigate('/admin/sales/' + p.id) : undefined,
          cells: [
            { initials: initials(p.buyer), title: p.buyer, strong: true, sub: salesStage(p.stage) },
            { title: p.property, wrap: true },
            { title: price(p.amount), strong: true },
            { title: price(p.paid), color: '#15803d' },
            { title: price(p.balance), color: '#c2410c', strong: true },
          ],
        })),
      },
    ];
    hasData = a.stats.revenue > 0 || a.stats.cost > 0 || a.revenueVsCost.some((m) => m.revenue || m.cost) || a.pendingPayments.length > 0;
  }

  const kpiCols = vw >= 1280 ? 'repeat(' + Math.min(5, Math.max(3, kpis.length || 4)) + ', minmax(0, 1fr))' : vw >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
  const chartCols = vw >= 1024 && charts.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
  const periods: Array<[Period, string]> = [['week', 'This Week'], ['month', 'This Month'], ['quarter', 'This Quarter'], ['year', 'This Year'], ['custom', 'Custom']];

  return (
    <div className={styles.page}>
      <Header title={title} subtitle={subtitle}>
        <div className={styles.filters}>
          <div className={styles.seg}>
            {periods.map(([k, label]) => (
              <button key={k} type="button" className={styles.segBtn} aria-pressed={period === k} onClick={() => setPeriod(k)} style={{ background: period === k ? '#2563eb' : '#ffffff', color: period === k ? '#ffffff' : '#334155' }}>
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <>
              <input type="date" className={styles.date} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" max={to || undefined} />
              <input type="date" className={styles.date} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" min={from || undefined} />
            </>
          )}
          <select className={styles.select} value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Property type">
            {TYPE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </Header>
      {typeF === 'Other' && (
        <p className={styles.note}>KPIs and charts include all property types (the analytics API filters one type at a time); the tables below show “Other” types only.</p>
      )}
      {q.isPending && (
        <>
          <div className={styles.grid} style={{ gridTemplateColumns: kpiCols }}>
            {[1, 2, 3, 4].map((s) => <Skeleton key={s} style={{ height: 104, borderRadius: 16 }} />)}
          </div>
          <Skeleton style={{ height: 320, borderRadius: 16 }} />
        </>
      )}
      {q.isError && <StateCard kind="error" onRetry={() => void q.refetch()} />}
      {q.isSuccess && !hasData && <StateCard kind="empty" />}
      {q.isSuccess && hasData && (
        <>
          <KpiGrid kpis={kpis} cols={kpiCols} />
          {charts.length > 0 && <div className={styles.grid} style={{ gridTemplateColumns: chartCols }}>{charts}</div>}
          {tables.map((tb) => (
            <div key={tb.title} className={styles.tableBlock}>
              <div>
                <h3 style={{ fontWeight: 600 }}>{tb.title}</h3>
                {tb.note && <p className={styles.small}>{tb.note}</p>}
              </div>
              <DataTable columns={tb.columns} rows={tb.rows} state={tb.state} empty={tb.empty} minWidth={tb.minWidth} errorTitle={'Could not load ' + tb.title.toLowerCase()} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const QUICK: Array<{ label: string; icon: string; path: CountPath; type: ExportReportType }> = [
  { label: 'All Properties', icon: 'building', path: '/v1/admin/properties', type: 'properties' },
  { label: 'All Users', icon: 'users', path: '/v1/admin/users', type: 'users' },
  { label: 'Sales & Deals', icon: 'trending-up', path: '/v1/admin/sales/deals', type: 'sales_deals' },
  { label: 'Acquisitions', icon: 'building-2', path: '/v1/admin/acquisitions', type: 'acquisitions' },
];
const DATA_TYPES: Record<string, ExportReportType> = { Properties: 'properties', Users: 'users', Sales: 'sales', Acquisitions: 'acquisitions' };
const TYPE_NAME: Record<string, string> = { properties: 'Properties', users: 'Users', sales: 'Sales', sales_deals: 'Sales & Deals', acquisitions: 'Acquisitions' };
const FIELD_KEYS: Record<string, string> = { ID: 'id', Title: 'title', Price: 'price', Status: 'status', City: 'city', Created: 'createdAt' };
const FORMATS: Array<[string, ExportFormat]> = [['CSV', 'csv'], ['Excel', 'xlsx'], ['PDF', 'pdf']];
const fmtName = (f: string) => (f === 'xlsx' || f === 'excel' ? 'Excel' : f.toUpperCase());

const SCHEDULE_TYPES: Array<[string, ScheduleReportType]> = [
  ['Overview', 'overview'], ['Sales', 'sales'], ['Acquisition', 'acquisition'], ['Revenue', 'revenue'], ['Users', 'users'], ['Properties', 'properties'],
];
const FREQUENCIES: Array<[string, ScheduleFrequency]> = [['Daily', 'daily'], ['Weekly', 'weekly'], ['Monthly', 'monthly']];

function ExportView() {
  const qc = useQueryClient();
  const { vw } = useViewport();
  const { admin, can } = useSession();
  const canSchedules = can('audit.read');
  const [dataType, setDataType] = useState('Properties');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [email, setEmail] = useState(admin?.email || '');
  const [fields, setFields] = useState<Record<string, boolean>>({ ID: true, Title: true, Price: true, Status: true, City: true, Created: false });
  const [busy, setBusy] = useState('');
  const [schedName, setSchedName] = useState('');
  const [schedType, setSchedType] = useState<ScheduleReportType>('sales');
  const [schedFreq, setSchedFreq] = useState<ScheduleFrequency>('weekly');
  const [schedFormat, setSchedFormat] = useState<ExportFormat>('xlsx');
  const [schedEmail, setSchedEmail] = useState(admin?.email || '');
  const counts = useQueries({ queries: QUICK.map((x) => ({ queryKey: ['record-count', x.path], queryFn: ({ signal }: { signal: AbortSignal }) => countRecords(x.path, signal), staleTime: 60_000 })) });
  const jobsQ = useQuery({
    queryKey: ['report-exports'],
    queryFn: ({ signal }) => listReportExports(signal),
    refetchInterval: (query) => ((query.state.data ?? []).some((j) => ['queued', 'processing'].includes(j.status)) ? 5000 : false),
  });
  const schedulesQ = useQuery({
    queryKey: ['report-schedules'],
    queryFn: ({ signal }) => listReportSchedules(signal),
    enabled: canSchedules,
  });

  const queue = async (reportType: ExportReportType, fmt: ExportFormat, extra: { fields?: string[]; deliveryEmail?: string | null; estimatedRows?: number } = {}) => {
    const key = reportType + fmt;
    setBusy(key);
    try {
      const job = await createReportExport({ reportType, format: fmt, ...extra });
      toast('⏳ ' + (TYPE_NAME[reportType] || reportType) + ' export queued' + (job.referenceId ? ' · ' + job.referenceId : ''));
      void qc.invalidateQueries({ queryKey: ['report-exports'] });
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    } finally {
      setBusy('');
    }
  };

  const download = async (j: ReportExport) => {
    setBusy('dl' + j.id);
    try {
      const { blob, fileName } = await downloadReportExport(j.id);
      saveBlob(blob, j.fileName || fileName);
      toast('📥 Downloading ' + (j.fileName || fileName));
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    } finally {
      setBusy('');
    }
  };

  const submit = () => {
    const chosen = Object.keys(fields).filter((k) => fields[k]);
    if (!chosen.length) return toast('Select at least one field');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email');
    const rt = DATA_TYPES[dataType]!;
    const idx = QUICK.findIndex((x) => x.type === rt || (rt === 'sales' && x.type === 'sales_deals'));
    void queue(rt, format, { fields: chosen.map((k) => FIELD_KEYS[k]!), deliveryEmail: email || null, estimatedRows: idx >= 0 ? counts[idx]?.data : undefined });
  };

  const createSchedule = async () => {
    if (!schedName.trim()) return toast('Schedule name is required');
    if (!/^\S+@\S+\.\S+$/.test(schedEmail.trim())) return toast('Enter a valid recipient email');
    setBusy('schedule');
    try {
      const job = await createReportSchedule({
        name: schedName.trim(),
        reportType: schedType,
        format: schedFormat,
        frequency: schedFreq,
        recipients: [schedEmail.trim()],
      });
      toast('📅 Schedule created' + (job.referenceId ? ' · ' + job.referenceId : ''));
      setSchedName('');
      void qc.invalidateQueries({ queryKey: ['report-schedules'] });
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    } finally {
      setBusy('');
    }
  };

  const stB = (s: string) => (s === 'completed' ? badge('Ready', 'green') : s === 'queued' ? badge('Queued', 'amber') : s === 'processing' ? badge('Processing', 'amber') : s === 'failed' ? badge('Failed', 'red') : badge('Expired', 'muted'));
  const jobs = jobsQ.data ?? [];
  const schedules = schedulesQ.data ?? [];
  const kpiCols = vw >= 1280 ? 'repeat(4, minmax(0, 1fr))' : vw >= 640 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';

  return (
    <div className={styles.page}>
      <Header title="Export Data" subtitle="Download reports as CSV, Excel, or PDF from backend-generated export jobs" />
      <div className={styles.grid} style={{ gridTemplateColumns: kpiCols }}>
        {QUICK.map((x, i) => {
          const c = counts[i]!;
          return (
            <div key={x.label} className={styles.quick}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={styles.quickIcon}><Icon name={x.icon} size={20} /></span>
                <div>
                  <p style={{ fontWeight: 600 }}>{x.label}</p>
                  <p className={styles.small}>{c.isPending ? 'Counting…' : c.isError ? 'Count unavailable' : c.data + ' records'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={styles.quickBtn} disabled={!!busy} onClick={() => void queue(x.type, 'csv', { estimatedRows: c.data })}>Export CSV</button>
                <button type="button" className={styles.quickBtn} disabled={!!busy} onClick={() => void queue(x.type, 'xlsx', { estimatedRows: c.data })}>Export Excel</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.panel}>
        <p style={{ fontWeight: 600 }}>Custom Export</p>
        <div className={styles.formGrid} style={{ gridTemplateColumns: vw >= 1024 ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
          <label className={styles.label}>
            Data type
            <select className={styles.input} value={dataType} onChange={(e) => setDataType(e.target.value)}>
              {Object.keys(DATA_TYPES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <div className={styles.label}>
            Format
            <div style={{ display: 'flex', gap: 6 }}>
              {FORMATS.map(([label, v]) => (
                <button key={v} type="button" className={styles.fmtBtn} aria-pressed={format === v} onClick={() => setFormat(v)} style={{ borderColor: format === v ? '#2563eb' : '#e2e8f0', background: format === v ? '#eff6ff' : '#ffffff', color: format === v ? '#1d4ed8' : '#334155' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '0 12px' }} />
          </label>
        </div>
        <p style={{ marginTop: 14, fontSize: 13, fontWeight: 500 }}>Select fields</p>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.keys(fields).map((k) => (
            <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!fields[k]} onChange={() => setFields((s) => ({ ...s, [k]: !s[k] }))} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
              {k}
            </label>
          ))}
        </div>
        <p className={styles.info}>This will be processed in background and emailed to you when ready.</p>
        <button type="button" className={styles.primary} disabled={!!busy} onClick={submit}>{busy && !busy.startsWith('dl') ? 'Requesting…' : 'Request Export'}</button>
      </div>
      {canSchedules && (
        <div className={styles.panel}>
          <p style={{ fontWeight: 600 }}>Scheduled Exports</p>
          <p className={styles.small}>Create recurring report jobs via POST /admin/reports/schedules</p>
          <div className={styles.formGrid} style={{ gridTemplateColumns: vw >= 1024 ? 'repeat(4, minmax(0, 1fr))' : 'minmax(0, 1fr)', marginTop: 12 }}>
            <label className={styles.label}>
              Name
              <input className={styles.input} value={schedName} onChange={(e) => setSchedName(e.target.value)} placeholder="Weekly sales" style={{ padding: '0 12px' }} />
            </label>
            <label className={styles.label}>
              Report
              <select className={styles.input} value={schedType} onChange={(e) => setSchedType(e.target.value as ScheduleReportType)}>
                {SCHEDULE_TYPES.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={styles.label}>
              Frequency
              <select className={styles.input} value={schedFreq} onChange={(e) => setSchedFreq(e.target.value as ScheduleFrequency)}>
                {FREQUENCIES.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={styles.label}>
              Format
              <select className={styles.input} value={schedFormat} onChange={(e) => setSchedFormat(e.target.value as ExportFormat)}>
                {FORMATS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={styles.label}>
              Recipient email
              <input className={styles.input} type="email" value={schedEmail} onChange={(e) => setSchedEmail(e.target.value)} style={{ padding: '0 12px' }} />
            </label>
          </div>
          <button type="button" className={styles.primary} style={{ marginTop: 12 }} disabled={busy === 'schedule'} onClick={() => void createSchedule()}>
            {busy === 'schedule' ? 'Creating…' : 'Create Schedule'}
          </button>
          <div style={{ marginTop: 16 }}>
            <DataTable
              columns={['Name', 'Report', 'Frequency', 'Format', 'Next run', 'Recipients', 'Status']}
              state={schedulesQ.isPending ? 'loading' : schedulesQ.isError ? 'error' : schedules.length ? 'normal' : 'empty'}
              onRetry={() => void schedulesQ.refetch()}
              errorTitle="Could not load schedules"
              empty={{ icon: 'calendar', title: 'No schedules yet', text: 'Create a recurring export above. Active schedules appear here from the backend.' }}
              minWidth="820px"
              rows={schedules.map((s) => ({
                key: s.id || s.referenceId,
                cells: [
                  { title: s.name, strong: true, sub: s.referenceId },
                  { title: statusLabel(s.reportType) },
                  { title: statusLabel(s.frequency) },
                  { title: fmtName(s.format) },
                  { title: dateTime(s.nextRunAt) || '—', muted: true },
                  { title: s.recipients.join(', ') || '—', muted: true },
                  { badges: [badge(s.status === 'active' ? 'Active' : statusLabel(s.status), s.status === 'active' ? 'green' : 'muted')] },
                ],
              }))}
            />
          </div>
        </div>
      )}
      <div className={styles.tableBlock}>
        <h3 style={{ fontWeight: 600 }}>Recent Exports</h3>
        <DataTable
          columns={['Reference', 'Data type', 'Format', 'Requested', 'Status', 'Rows', 'Expires', 'Action']}
          state={jobsQ.isPending ? 'loading' : jobsQ.isError ? 'error' : jobs.length ? 'normal' : 'empty'}
          onRetry={() => void jobsQ.refetch()}
          errorTitle="Could not load export jobs"
          empty={{ icon: 'download', title: 'No exports yet', text: 'No export jobs have been queued yet. New CSV, Excel, and PDF requests will appear here after the backend accepts them.' }}
          minWidth="900px"
          rows={jobs.map((j) => ({
            key: j.id || j.referenceId,
            cells: [
              { title: j.referenceId, strong: true },
              { title: TYPE_NAME[j.reportType] || statusLabel(j.reportType) },
              { title: fmtName(j.format) },
              { title: dateTime(j.requestedAt), muted: true },
              { badges: [stB(j.status)], sub: j.status === 'failed' ? j.failureReason : null },
              { title: j.rowCount != null ? String(j.rowCount) : '—' },
              { title: date(j.expiresAt) || '—', muted: true },
              {
                actions: [
                  j.status === 'completed'
                    ? { label: busy === 'dl' + j.id ? 'Downloading…' : 'Download', icon: 'download', disabled: !!busy, onClick: () => void download(j) }
                    : { label: j.status === 'queued' || j.status === 'processing' ? 'Processing…' : j.status === 'failed' ? 'Failed' : 'Expired', disabled: true, onClick: () => undefined },
                ],
              },
            ],
          }))}
        />
      </div>
    </div>
  );
}
